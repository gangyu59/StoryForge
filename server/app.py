"""StoryForge 服务：静态页面 + /api/*。
AI 只用本机已登录的 Claude 订阅（claude 命令行，无需 API Key）；角色语音用 edge-tts。"""
import asyncio
import hmac
import json
import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import claude_cli, routes_ext, voice

ROOT = Path(__file__).resolve().parent.parent
MODEL = os.environ.get("SF_CLAUDE_MODEL", "sonnet")       # 剧情对话：谈话的知识与文采取决于它（haiku 更省额度但更浅）
BUILD_MODEL = os.environ.get("SF_CLAUDE_BUILD_MODEL", "sonnet")  # 自定义世界/任务 JSON：要准
SYSTEM = "你是一个互动旅行小说的叙事 AI。严格遵守用户给出的格式要求，只输出故事/要求的内容，不要解释，不要寒暄。"
slots = asyncio.Semaphore(2)

ACCESS_CODE = os.environ.get("SF_ACCESS_CODE", "")   # 设了就要求 /api/* 带口令（用 ngrok 等暴露到公网时务必设置）

app = FastAPI(title="StoryForge")


class AccessGuard:
    """纯 ASGI 中间件：口令不对的 /api/* 请求直接 401。"""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if ACCESS_CODE and scope["type"] == "http" and scope["path"].startswith("/api/") and scope["path"] != "/api/health":
            got = dict(scope["headers"]).get(b"x-access-code", b"").decode("utf-8", "ignore")
            if not hmac.compare_digest(got, ACCESS_CODE):
                body = json.dumps({"detail": "需要访问口令", "code": "auth"}, ensure_ascii=False).encode()
                await send({"type": "http.response.start", "status": 401,
                            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
                await send({"type": "http.response.body", "body": body})
                return
        await self.inner(scope, receive, send)


app.add_middleware(AccessGuard)
STARTED = time.time()
VERSION = "2.0.0"
app.include_router(routes_ext.router)   # 外部控制器接口（/api/catalog、/api/jobs、/api/overview）


@app.on_event("startup")
async def _startup():
    voice.prune()
    if os.environ.get("SF_STT_PRELOAD", "1") != "0":
        voice.preload()   # 后台预热 Whisper，第一次开口不用等


@app.get("/api/health")
def health():
    return {"service": "storyforge", "pid": os.getpid(), "ok": True, "claude": bool(claude_cli.claude_binary()), "last": claude_cli.LAST, "model": MODEL,
            "tts": voice.available(), "build": build_id(), "auth": bool(ACCESS_CODE), "stt": voice.stt_available(), "stt_state": voice.state["status"],
            "version": VERSION, "uptime_s": int(time.time() - STARTED)}


class LLMIn(BaseModel):
    prompt: str = Field(max_length=20000)
    system: str = Field(SYSTEM, max_length=4000)
    model: str = Field("", max_length=40)  # "fast" | "smart" | ""


def _model(name: str) -> str:
    return BUILD_MODEL if name == "smart" else MODEL


@app.post("/api/llm")
async def llm(body: LLMIn):
    """一次性返回完整文本：{text}。"""
    buf = ""
    try:
        async with slots:
            async for piece in claude_cli.stream_claude(body.system, body.prompt, _model(body.model), timeout=120):
                buf += piece
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    return {"text": buf}


@app.post("/api/llm/stream")
async def llm_stream(body: LLMIn):
    """SSE：{type:'delta',text} … {type:'done'}；出错 {type:'error',message}。"""
    async def gen():
        try:
            async with slots:
                async for piece in claude_cli.stream_claude(body.system, body.prompt, _model(body.model)):
                    yield "data: " + json.dumps({"type": "delta", "text": piece}, ensure_ascii=False) + "\n\n"
            yield 'data: {"type":"done"}\n\n'
        except Exception as e:  # noqa: BLE001
            yield "data: " + json.dumps({"type": "error", "message": str(e)[:200]}, ensure_ascii=False) + "\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


MAX_PCM = 16000 * 2 * 60


@app.post("/api/voice/stt")
async def stt(request: Request):
    """请求体：16kHz 单声道 PCM16 原始字节。没有有效语音返回空文本。"""
    if not voice.stt_available():
        raise HTTPException(503, "没装语音识别（pip install mlx-whisper）")
    pcm = await request.body()
    if len(pcm) > MAX_PCM:
        raise HTTPException(413, "录音太长")
    try:
        return {"text": await voice.transcribe(pcm)}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, "语音识别失败：" + str(e)[:120])


# ───────── 我的世界：自建场景持久化（data/worlds.json） ─────────
WORLDS = ROOT / "data" / "worlds.json"
worlds_lock = asyncio.Lock()


def _read_worlds() -> list:
    try:
        return json.loads(WORLDS.read_text("utf-8"))
    except (OSError, ValueError):
        return []


def _write_worlds(items: list) -> None:
    WORLDS.parent.mkdir(parents=True, exist_ok=True)
    tmp = WORLDS.with_suffix(".tmp")
    tmp.write_text(json.dumps(items, ensure_ascii=False, indent=1), "utf-8")
    tmp.replace(WORLDS)   # 原子替换，写到一半断电也不会毁掉旧数据


class WorldIn(BaseModel):
    id: str = Field(pattern=r"^custom[A-Za-z0-9_\-]{1,60}$")
    title: str = Field(max_length=60)
    desc: str = Field("", max_length=1000)
    spec: dict


@app.get("/api/worlds")
async def worlds_list():
    return {"worlds": _read_worlds()}


@app.post("/api/worlds")
async def worlds_save(w: WorldIn):
    if not isinstance(w.spec.get("characters"), list) or not w.spec.get("opening"):
        raise HTTPException(422, "世界设定不完整")
    async with worlds_lock:
        items = [x for x in _read_worlds() if x.get("id") != w.id]
        items.insert(0, {**w.model_dump(), "created": int(time.time())})
        _write_worlds(items[:100])
    return {"ok": True}


@app.delete("/api/worlds/{wid}")
async def worlds_delete(wid: str):
    async with worlds_lock:
        _write_worlds([x for x in _read_worlds() if x.get("id") != wid])
    return {"ok": True}


@app.get("/api/voice/voices")
async def voice_voices():
    return {"voices": await voice.list_voices()}


@app.get("/api/voice/roles")
def voice_roles():
    return {"available": voice.available(), "roles": voice.ROLE_VOICES}


@app.get("/api/voice/tts")
async def tts(text: str = Query(..., min_length=1, max_length=500), role: str = "narrator", voice_id: str = Query("", alias="voice")):
    if not voice.available():
        raise HTTPException(503, "没装 edge-tts（pip install edge-tts）")
    if voice_id and voice_id not in {v["id"] for v in await voice.list_voices()}:
        raise HTTPException(422, "不认识的声音")
    speech = voice.clean(text)
    if not speech:
        raise HTTPException(422, "没有可朗读的文字")
    try:
        return Response(await voice.tts(speech, role, voice_id), media_type="audio/mpeg",
                        headers={"Cache-Control": "public, max-age=86400"})
    except RuntimeError as e:
        raise HTTPException(502, str(e)[:160])


class NoCacheStatic(StaticFiles):
    """静态文件每次都向服务器确认是否更新。不用 BaseHTTPMiddleware：它包住流式响应时，客户端断开会抛 CancelledError。"""

    async def get_response(self, path, scope):
        resp = await super().get_response(path, scope)
        resp.headers["Cache-Control"] = "no-cache"
        return resp


# 静态页面：只开放前端目录，避免暴露 server/、data/、.git
for d in ("css", "js", "assets"):
    app.mount("/" + d, NoCacheStatic(directory=str(ROOT / d)), name=d)


def build_id() -> str:
    """前端文件的最新修改时间：任何改动都会让版本号变化。"""
    m = 0
    for pat in ("index.html", "js/**/*.js", "css/*.css"):
        for f in ROOT.glob(pat):
            m = max(m, int(f.stat().st_mtime))
    return format(m, "x")[-6:]


@app.get("/")
def index():
    """给所有脚本/样式加 ?v=版本号：改过的文件浏览器一定重新下载，不会用到旧缓存。"""
    import re
    v = build_id()
    html = (ROOT / "index.html").read_text("utf-8")
    html = re.sub(r'((?:src|href)="(?:js|css)/[^"?]+)"', lambda m: m.group(1) + "?v=" + v + '"', html)
    html = html.replace("<head>", '<head>\n<meta name="sf-build" content="%s">' % v, 1)
    return Response(html, media_type="text/html", headers={"Cache-Control": "no-cache"})
