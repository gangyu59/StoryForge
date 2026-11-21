"""供外部控制器（OmniTwin）调用的接口：只读目录、一次性异步任务、只读概览。
游戏状态在浏览器里，服务端无状态：这里的任务不读不写任何存档（data/worlds.json 也不碰），结果只放内存。"""
import asyncio
import json
import re
import uuid
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from . import claude_cli, themes, voice

router = APIRouter(prefix="/api")

WORLD_TIMEOUT = 120
SCENE_TIMEOUT = 90
MAX_KEPT = 50
DISCLAIMER = "这是 AI 生成的虚构设定，不会自动加入页面，也没有写入任何存档。"

# 前端 journey_engine.js 的 STYLE_SUFFIX：每一轮剧情请求都会拼在 buildPrompt 后面，这里保持一致，输出格式才可解析
STYLE_SUFFIX = "\n".join([
    "",
    "【最高优先级规则：玩家是真人】",
    "- “玩家”由用户本人扮演。你绝对不能替玩家写台词、想法、心理、表情、动作或决定，也不要复述或改写玩家说过的话",
    "- 只写其他三位角色和周围环境；需要玩家回应时，让朋友们提问、停下来等玩家开口，然后这一轮就结束",
    "",
    "【输出格式（必须遵守）】",
    "- 一行一句：要么是【环境/动作描写】（整行用【】包裹，不超过 40 字），要么是「人物名：台词」",
    "- 台词必须口语化、简短（单句不超过 35 字），像朋友一路上随口聊天：会接话、插话、打趣、互相照顾",
    "- 台词里不要出现任何括号或动作描写，情绪靠说话的语气和用词来表达",
    "- 本轮共写 5～8 行，台词占多数，不要加任何标题、解释或总结",
])

# 与 app.py 的 SYSTEM 相同（懒取，避免循环导入）
def _system() -> str:
    from . import app as m
    return m.SYSTEM


def _models() -> tuple:
    from . import app as m
    return m.MODEL, m.BUILD_MODEL


# ───────────────────────── 参数模型（多余字段一律拒绝）─────────────────────────
class WorldParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str = Field(max_length=300)

    @field_validator("description")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("blank")
        return v


class SceneParams(BaseModel):
    model_config = ConfigDict(extra="forbid")
    theme: str = Field(max_length=60)
    player_input: str = Field("", max_length=300)
    opening: bool = True


class JobIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: str = Field(max_length=30)
    params: dict[str, Any] = Field(default_factory=dict)


def _zh_error(e: ValidationError) -> str:
    parts = []
    for x in e.errors():
        loc = ".".join(str(i) for i in x["loc"]) or "params"
        t = x["type"]
        why = ("不认识的参数" if t == "extra_forbidden" else "缺少必填项" if t == "missing"
               else "太长了" if t == "string_too_long" else "取值不合法")
        parts.append(f"{loc}: {why}")
    return "；".join(parts)


# ───────────────────────── 目录 ─────────────────────────
@router.get("/catalog")
def catalog():
    play, build = _models()
    return {"jobs": [
        {"id": "world", "name": "构思一个新世界",
         "description": "用一句话描述你想进入的世界，Claude 生成标题、开场、4 个角色（含「玩家」）和叙事规则；不会自动加入页面，不写入任何存档",
         "params": [{"name": "description", "type": "string", "max_length": 300, "required": True}],
         "consumes_claude": True, "model_tier": build, "estimated_seconds": {"typical": 20, "max": WORLD_TIMEOUT}},
        {"id": "scene", "name": "试读一段剧情",
         "description": "选一个世界，写下你想说的话（可不填），让朋友们把故事往前推一段；只返回文字，不记录进度",
         "params": [
             {"name": "theme", "type": "string", "enum": themes.theme_choices(), "required": True},
             {"name": "player_input", "type": "string", "max_length": 300, "default": "", "required": False,
              "note": "留空表示玩家沉默"},
             {"name": "opening", "type": "boolean", "default": True, "required": False,
              "note": "是否在结果里带上该世界的开场白"},
         ],
         "consumes_claude": True, "model_tier": play, "estimated_seconds": {"typical": 10, "max": SCENE_TIMEOUT}},
    ]}


# ───────────────────────── 调 Claude ─────────────────────────
async def _call_claude(system: str, prompt: str, model: str, timeout: float) -> str:
    """走与 /api/llm 相同的并发限制（slots）。失败抛 RuntimeError，消息已是中文。"""
    from . import app as m
    if not claude_cli.claude_binary():
        raise RuntimeError("claude 命令行不可用（可设环境变量 CLAUDE_BIN）")
    buf = ""
    async with m.slots:
        async for piece in claude_cli.stream_claude(system, prompt, model, timeout=timeout):
            buf += piece
    return buf


def _friendly(e: Exception) -> str:
    msg = str(e).strip()
    if "超过" in msg and "未返回" in msg:
        return "生成超时，请稍后再试"
    if "找不到 claude" in msg or "命令行不可用" in msg:
        return "claude 命令行不可用"
    if msg and re.search(r"[一-鿿]", msg):
        return msg[:200]
    return "Claude 调用失败，请稍后再试"


# ───────────────────────── 世界：提示词与校验 ─────────────────────────
def build_world_prompt(description: str) -> str:
    """与 js/game/journey_custom_builder.js 的提示词逐字一致。"""
    return f"""
你是一个【AI 世界构建器】。

用户将描述一个他想进入的世界。
你的任务是：把这个描述转化为一个【可用于互动小说的世界设定】。

⚠️ 输出必须是 JSON，不能有多余解释。

JSON 格式如下（字段必须完整）：

{{
  "id": "custom_xxx",
  "title": "世界名称",
  "opening": "【开场环境描写】",
  "characters": [
    {{
      "name": "角色名",
      "gender": "女 或 男",
      "persona": "一句话性格"
    }}
  ],
  "rules": [
    "规则1",
    "规则2"
  ]
}}

规则说明：
1. opening 必须是 system 描述，用【】包裹
2. characters 固定 4 个：其中一个叫“玩家”（gender 写空字符串）；另外 3 个必须恰好是 1 位女性、2 位男性（用 gender 字段标注“女”或“男”，名字和性格描述都要与性别相符，因为界面头像是 1 女 2 男）
3. 风格偏小说、电影感
4. 不要太抽象，要具体、可展开

用户描述的世界是：
「{description}」
""".strip()


def extract_json(text: str) -> Optional[dict]:
    """与前端 SF.llm.extractJSON 同一做法：去掉代码围栏，取第一个 { 到最后一个 }。"""
    if not text:
        return None
    t = re.sub(r"```(?:json)?", "", str(text), flags=re.I)
    i, j = t.find("{"), t.rfind("}")
    if i < 0 or j <= i:
        return None
    try:
        v = json.loads(t[i:j + 1])
    except ValueError:
        return None
    return v if isinstance(v, dict) else None


class BadResult(Exception):
    """模型输出不符合要求；消息直接给用户看。"""


def parse_world(text: str, job_id: str) -> dict:
    data = extract_json(text)
    if data is None:
        raise BadResult("生成的内容不是有效的 JSON，请换种说法再试")
    title, opening = data.get("title"), data.get("opening")
    if not isinstance(title, str) or not title.strip():
        raise BadResult("生成的世界缺少标题，请换种说法再试")
    if not isinstance(opening, str) or not opening.strip():
        raise BadResult("生成的世界缺少开场白，请换种说法再试")
    chars = data.get("characters")
    if not isinstance(chars, list) or len(chars) != 4:
        raise BadResult("生成的世界缺少 4 个角色，请换种说法再试")
    out = []
    for c in chars:
        if not isinstance(c, dict) or not isinstance(c.get("name"), str) or not c["name"].strip() \
                or not isinstance(c.get("persona"), str) or not c["persona"].strip():
            raise BadResult("生成的角色缺少名字或性格，请换种说法再试")
        out.append({"name": c["name"].strip(), "persona": c["persona"].strip()})
    if sum(1 for c in out if c["name"] == "玩家") != 1:
        raise BadResult("生成的世界必须恰好有一个叫「玩家」的角色，请换种说法再试")
    rules = data.get("rules")
    if not isinstance(rules, list) or not rules or not all(isinstance(r, str) and r.strip() for r in rules):
        raise BadResult("生成的世界缺少叙事规则，请换种说法再试")
    return {"id": "custom_" + job_id, "title": title.strip(), "opening": opening.strip(), "characters": out,
            "rules": [r.strip() for r in rules], "disclaimer": DISCLAIMER}


# ───────────────────────── 剧情：逐行解析 ─────────────────────────
_SPEAK = re.compile(r"^([^:：]{1,12})[:：]\s*(.+)$")
_NARRATOR = {"system", "系统", "旁白"}


def parse_scene(text: str) -> list:
    lines: list = []
    last = "旁白"
    for raw in (text or "").splitlines():
        line = raw.strip()
        line = re.sub(r"^\s*[\-\*•]\s+", "", line)
        line = re.sub(r"^\s*\d+[\)\.、]\s*", "", line)
        line = re.sub(r"^[#>\s]+", "", line).replace("*", "").strip()
        if not line:
            continue
        if line[0] == "【" and line[-1] == "】":
            body = line[1:-1].strip()
            if body:
                lines.append({"speaker": "旁白", "text": body})
                last = "旁白"
            continue
        m = _SPEAK.match(line)
        if m:
            speaker = m.group(1).strip()
            speaker = "旁白" if speaker.lower() in _NARRATOR else speaker
            content = m.group(2).strip().strip("「」").strip()
            if content:
                lines.append({"speaker": speaker, "text": content})
                last = speaker
            continue
        lines.append({"speaker": last, "text": line})
    return lines


# ───────────────────────── 异步任务（内存）─────────────────────────
JOBS: dict[str, dict] = {}
_tasks: set = set()  # 防止后台任务被垃圾回收


def _running() -> bool:
    return any(j["status"] == "running" for j in JOBS.values())


async def _run(job: dict, params) -> None:
    done = False
    try:
        play, build = _models()
        job["phase"] = "Claude 生成中"
        if job["kind"] == "world":
            text = await _call_claude(_system(), build_world_prompt(params.description), build, WORLD_TIMEOUT)
            job["phase"] = "解析中"
            result = parse_world(text, job["job_id"])
        else:
            theme = themes.get_theme(params.theme)
            prompt = themes.build_scene_prompt(theme, themes.opening_history(theme), params.player_input or None)
            text = await _call_claude(_system(), prompt + "\n" + STYLE_SUFFIX, play, SCENE_TIMEOUT)
            job["phase"] = "解析中"
            lines = parse_scene(text)
            if not lines:
                raise BadResult("没有解析出任何剧情内容，请重试")
            result = {"theme": theme["id"], "title": theme["title"],
                      "opening": themes.opening_text(theme) if params.opening else None,
                      "lines": lines, "raw": text, "player_input": params.player_input}
        job.update(result=result, progress=1.0, phase="完成", status="done")
        done = True
    except BadResult as e:
        job["error_message"] = str(e)
    except Exception as e:  # noqa: BLE001  不返回栈信息
        job["error_message"] = _friendly(e)
    finally:
        if not done:
            job["status"], job["phase"] = "error", "失败"


def _public(job: dict) -> dict:
    return {k: job[k] for k in ("job_id", "kind", "status", "progress", "phase", "result", "error_message")}


def create_job_from(payload: Any) -> dict:
    """校验 + 登记 + 起后台协程。须在事件循环里调用。"""
    if not isinstance(payload, dict):
        raise HTTPException(400, "请求体必须是 JSON 对象")
    try:
        body = JobIn(**payload)
    except ValidationError as e:
        raise HTTPException(400, "请求不合法：" + _zh_error(e))
    model = {"world": WorldParams, "scene": SceneParams}.get(body.kind)
    if not model:
        raise HTTPException(400, f"不认识的任务类型「{body.kind[:30]}」，可用：world、scene")
    try:
        params = model(**body.params)
    except ValidationError as e:
        raise HTTPException(400, "参数不合法：" + _zh_error(e))
    if body.kind == "scene" and not themes.get_theme(params.theme):
        raise HTTPException(422, f"不认识的世界「{params.theme[:30]}」，可选：" + "、".join(themes.THEMES))
    if _running():  # 检查和登记之间没有 await，不会被并发请求穿插
        raise HTTPException(409, "已有任务在运行，请等它结束")
    job = {"job_id": uuid.uuid4().hex[:12], "kind": body.kind, "status": "running", "progress": 0.0,
           "phase": "排队", "result": None, "error_message": None}
    JOBS[job["job_id"]] = job
    for old in [k for k, v in JOBS.items() if v["status"] != "running"][:-MAX_KEPT]:
        del JOBS[old]
    t = asyncio.create_task(_run(job, params))
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)
    return {"job_id": job["job_id"]}


@router.post("/jobs")
async def create_job(request: Request):
    try:
        payload = await request.json()
    except ValueError:
        raise HTTPException(400, "请求体不是有效的 JSON")
    return create_job_from(payload)


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "没有这个任务（服务重启后任务记录会丢失）")
    return _public(job)


# ───────────────────────── 只读概览（不调 Claude、不写盘）─────────────────────────
@router.get("/overview")
def overview():
    play, build = _models()
    return {
        "themes": [{"id": t["id"], "title": t["title"], "characters": [c["name"] for c in t["characters"]]}
                   for t in themes.THEMES.values()],
        "roles": list(voice.ROLE_VOICES),
        "tts": voice.available(),
        "stt": voice.stt_available(),
        "stt_state": voice.state["status"],
        "claude": bool(claude_cli.claude_binary()),
        "models": {"play": play, "build": build},
    }
