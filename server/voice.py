"""语音：微软 edge-tts 朗读角色台词（按文本缓存 mp3）+ 本机 Whisper 识别玩家说话（Apple 芯片 mlx-whisper，否则 faster-whisper）。"""
import asyncio
import hashlib
import os
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TTS_DIR = ROOT / "data" / "tts_cache"
TTS_CACHE_MAX = 3000

# 每个角色一个固定声音（槽位与前端 sakura/jerry/kevin/michelle 一一对应）
# rate/pitch 让三个人听起来性格不同：知樱柔和偏慢、行简沉稳、方野轻快
ROLE_VOICES = {
    "sakura":   {"voice": "zh-CN-XiaoxiaoNeural", "rate": "+0%",  "pitch": "+2Hz",  "label": "林之樱 · 晓晓"},
    "jerry":    {"voice": "zh-CN-YunyangNeural",  "rate": "-2%",  "pitch": "-1Hz",  "label": "周行简 · 云扬"},
    "kevin":    {"voice": "zh-CN-YunxiNeural",    "rate": "+8%",  "pitch": "+2Hz",  "label": "方野 · 云希"},
    "michelle": {"voice": "zh-CN-XiaoyiNeural",   "rate": "+0%",  "pitch": "+0Hz",  "label": "你 · 晓伊"},
    "narrator": {"voice": "zh-CN-YunjianNeural",  "rate": "-8%",  "pitch": "+0Hz",  "label": "旁白 · 云健"},
}
_RATE = re.compile(r"[+-]\d{1,3}%")
_PITCH = re.compile(r"[+-]\d{1,3}Hz")


def available() -> bool:
    try:
        import edge_tts  # noqa: F401
        return True
    except ImportError:
        return False


def clean(text: str) -> str:
    text = re.sub(r"[*_`>#~]+", "", text)
    text = re.sub(r"[（(][^）)]{0,20}[）)]", "", text)  # 舞台动作括号不念
    return re.sub(r"\s+", " ", text).strip()


def prune() -> None:
    try:
        files = sorted(TTS_DIR.glob("*.mp3"), key=lambda f: f.stat().st_mtime)
        for f in files[:max(0, len(files) - TTS_CACHE_MAX)]:
            f.unlink(missing_ok=True)
    except OSError:
        pass


# ───────── 可选声音列表（普通话 / 方言 / 港台） ─────────
_PY = {"Xiaoxiao": "晓晓", "Xiaoyi": "晓伊", "Yunjian": "云健", "Yunxi": "云希", "Yunxia": "云夏", "Yunyang": "云扬",
       "Xiaobei": "晓北", "Xiaoni": "晓妮", "HiuGaai": "曉佳", "HiuMaan": "曉曼", "WanLung": "雲龍",
       "HsiaoChen": "曉臻", "HsiaoYu": "曉雨", "YunJhe": "雲哲"}
_TAG = {"Warm": "温暖", "Lively": "活泼", "Passion": "激昂", "Sunshine": "阳光", "Cute": "可爱", "Professional": "专业",
        "Reliable": "可靠", "Humorous": "幽默", "Bright": "明亮", "Friendly": "亲切", "Positive": "积极"}
_REGION = {"zh-CN": "普通话", "zh-CN-liaoning": "东北话", "zh-CN-shaanxi": "陕西话", "zh-HK": "粤语", "zh-TW": "台湾"}
_FALLBACK = [v["voice"] for v in ROLE_VOICES.values()] + ["zh-CN-YunxiaNeural"]
_voice_list = None


async def list_voices() -> list:
    """从微软拉可用的中文声音（缓存）；拉不到就退回内置的几个。"""
    global _voice_list
    if _voice_list is not None:
        return _voice_list
    out = []
    try:
        import edge_tts
        for v in await edge_tts.list_voices():
            if not v["Locale"].startswith("zh-") or "Multilingual" in v["ShortName"]:
                continue
            short = v["ShortName"].split("-")[-1].replace("Neural", "")
            tags = "、".join(_TAG.get(t, t) for t in (v.get("VoiceTag") or {}).get("VoicePersonalities", [])[:2])
            name = _PY.get(short, short)
            gender = "女" if v["Gender"] == "Female" else "男"
            out.append({"id": v["ShortName"], "label": "%s · %s · %s%s" % (name, gender, _REGION.get(v["Locale"], v["Locale"]),
                                                                           " · " + tags if tags else ""),
                        "gender": gender, "locale": v["Locale"]})
        out.sort(key=lambda x: (x["locale"] != "zh-CN", x["locale"], x["gender"] != "女", x["id"]))
    except Exception:  # noqa: BLE001
        out = [{"id": i, "label": i.replace("zh-CN-", "").replace("Neural", ""), "gender": "", "locale": "zh-CN"} for i in dict.fromkeys(_FALLBACK)]
    if out:
        _voice_list = out
    return out


async def tts(text: str, role: str, voice: str = "") -> bytes:
    import edge_tts
    cfg = dict(ROLE_VOICES.get(role) or ROLE_VOICES["narrator"])
    if voice and voice != cfg["voice"]:           # 用户自选的声音：用中性语速/音调，不沿用角色默认的微调
        cfg.update(voice=voice, rate="+0%", pitch="+0Hz")
    TTS_DIR.mkdir(parents=True, exist_ok=True)
    f = TTS_DIR / (hashlib.md5(f"{cfg['voice']}|{cfg['rate']}|{cfg['pitch']}|{text}".encode()).hexdigest() + ".mp3")
    if f.exists():
        return f.read_bytes()
    last = None
    for _ in range(3):
        try:
            buf = bytearray()
            async for ch in edge_tts.Communicate(text, cfg["voice"], rate=cfg["rate"], pitch=cfg["pitch"]).stream():
                if ch["type"] == "audio":
                    buf += ch["data"]
            if buf:
                f.write_bytes(bytes(buf))
                return bytes(buf)
        except Exception as e:  # noqa: BLE001
            last = e
            await asyncio.sleep(0.3)
    raise RuntimeError("语音合成失败：%s" % last)


# ───────── 语音识别（Whisper，本机） ─────────
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
STT_MODEL = os.environ.get("SF_STT_MODEL", "large-v3-turbo")
MLX_REPO = os.environ.get("SF_STT_MLX_REPO", "mlx-community/whisper-large-v3-turbo")
STT_LANG = os.environ.get("SF_STT_LANG", "zh")
PROMPT = "这是几个朋友一起旅行时的聊天对话，说的是普通话。"

state = {"status": "idle", "error": "", "engine": ""}   # idle | loading | ready | error
_model = None
_engine = ""
# MLX 的 GPU 流绑定线程：加载与识别必须始终在同一线程
_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="stt")


def stt_available() -> bool:
    for mod in ("mlx_whisper", "faster_whisper"):
        try:
            __import__(mod)
            return True
        except ImportError:
            continue
    return False


def _load() -> None:
    global _model, _engine
    if _model is not None:
        return
    state.update(status="loading", error="")
    try:
        try:
            import mlx_whisper
            import numpy as np
            mlx_whisper.transcribe(np.zeros(16000, dtype=np.float32), path_or_hf_repo=MLX_REPO, language=STT_LANG)  # 预热
            _model, _engine = mlx_whisper, "mlx"
        except ImportError:
            from faster_whisper import WhisperModel
            _model, _engine = WhisperModel(STT_MODEL, device="cpu", compute_type="int8", cpu_threads=8), "faster"
        state.update(status="ready", engine=_engine)
    except Exception as e:  # noqa: BLE001
        state.update(status="error", error=str(e)[:200])
        raise


def preload() -> None:
    if stt_available():
        _pool.submit(_load).add_done_callback(lambda x: x.exception())


_HALLUCINATIONS = ("请不吝点赞", "订阅", "字幕", "谢谢观看", "感谢观看", "谢谢大家", "下期再见", "拜拜", "Thank you",
                   "thanks for watching", "ご視聴ありがとう", "李宗盛", "明镜", "志愿者")


def is_garbage(t: str) -> bool:
    """静音/噪声下 Whisper 会输出重复字或固定的幻觉句，一律视为无效。"""
    t = (t or "").strip()
    if not t:
        return True
    if re.search(r"(.)\1{6,}", t) or re.search(r"(.{2,8})\1{3,}", t):
        return True
    if len(t) > 12 and len(set(t)) / len(t) < 0.25:
        return True
    if re.sub(r"[\s、。，,.！？!?…~]", "", t) == "" or PROMPT[:10] in t:
        return True
    return len(t) < 20 and any(h.lower() in t.lower() for h in _HALLUCINATIONS)


def _transcribe(pcm16: bytes) -> str:
    import numpy as np
    _load()
    audio = np.frombuffer(pcm16, dtype=np.int16).astype(np.float32) / 32768.0
    if len(audio) < 16000 * 0.3:
        return ""
    if _engine == "mlx":
        r = _model.transcribe(audio, path_or_hf_repo=MLX_REPO, language=STT_LANG, initial_prompt=PROMPT, temperature=0.0,
                              condition_on_previous_text=False, no_speech_threshold=0.5, compression_ratio_threshold=2.2)
        text = r["text"].strip()
    else:
        segs, _ = _model.transcribe(audio, language=STT_LANG, initial_prompt=PROMPT, beam_size=1, vad_filter=True,
                                    vad_parameters={"min_silence_duration_ms": 300}, condition_on_previous_text=False,
                                    no_speech_threshold=0.5, temperature=0.0)
        text = "".join(s.text for s in segs).strip()
    text = re.sub(r"([\u4e00-\u9fff，。！？,.!?])\s*[A-Za-zＡ-Ｚａ-ｚ]{1,2}[。.]?$", r"\1", text).strip()   # 句尾偶发的孤立字母
    return "" if is_garbage(text) else text


async def transcribe(pcm16: bytes) -> str:
    """16kHz 单声道 PCM16 → 文字。"""
    return await asyncio.get_running_loop().run_in_executor(_pool, _transcribe, pcm16)
