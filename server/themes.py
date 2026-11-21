"""三个内置旅程世界的设定（Python 版）。

与 js/game/journey_themes 手工保持一致：前端 JS 不依赖本文件，本文件也不读取 JS；
改了任何一边，请人工同步另一边。id 与前端一致（kyoto / antarctica / africa）。
"""
from typing import Optional

PLAYER_NOTE = " ——【真人，由用户本人扮演，你绝对不能替玩家说话或行动】"
NO_PLAYER_INPUT = "（玩家还没有开口，由朋友们自己把故事往前推）"

THEMES: dict = {
    "kyoto": {
        "id": "kyoto",
        "title": "京都 · 赏樱之旅",
        "opening": (
            "阳光温柔地洒在京都的街道上，街边的樱花树如粉色的云海般绽放。\n"
            "微风拂过，花瓣轻轻飘落，仿佛下起了一场安静的花雨。\n"
            "四人刚刚抵达京都，站在街口，行李箱在身旁，空气中带着春天特有的清新气息。"
        ),
        # 角色库设定（name / persona 与 kyoto_sakura.js 的 characters 一致）
        "characters": [
            {"name": "林之樱", "persona": "感性、浪漫、细腻，容易被风景和情绪触动"},
            {"name": "周行简", "persona": "理性、计划型，习惯提前安排路线和时间"},
            {"name": "方野", "persona": "随性、幽默，享受当下，不喜欢被计划束缚"},
            {"name": "玩家", "persona": "坚毅、认真、逻辑强，也懂得幽默，是团队的一员"},
        ],
        # ↓ 以下是 buildPrompt 里写死的文案（与 characters 的 persona 略有不同，照抄 JS）
        "intro": "你正在写一部【正在发生的旅行小说】。",
        "background": "京都 · 春天 · 赏樱之旅",
        "env_title": None,
        "env": [],
        "cast": [
            ("林之樱", "感性、浪漫、细腻"),
            ("周行简", "理性、计划型"),
            ("方野", "随性、享受当下"),
            ("玩家", "坚毅、逻辑强、有乐趣，是团队一员"),
        ],
        "rules_title": "📜 叙事规则（非常重要）：",
        "rules": [
            "system 只能用于【环境 / 动作 / 时间变化】的描述，不能像人在说话",
            "人物发言格式必须是：人物名：内容",
            "每一轮必须推进【时间、地点或事件】",
            "至少两位人物发言",
            "允许分歧，但不要停在讨论，一定要继续发生事情",
            "不要总结，不要解释，不要写“他们决定了什么”",
            "像小说一样自然展开，保持画面感",
        ],
        "outro": "不要解释你在做什么，直接写小说内容。",
    },
    "antarctica": {
        "id": "antarctica",
        "title": "南极 · 探险之旅",
        "opening": (
            "【南极大陆】\n\n"
            "运输机的轰鸣声逐渐远去，只剩下风声在冰原上回荡。\n"
            "白色的世界一望无际，冰层在脚下发出低沉的回响。\n"
            "空气寒冷而干燥，每一次呼吸都清晰可闻。"
        ),
        "characters": [
            {"name": "林之樱", "persona": "感性、细腻，在极端环境下更容易情绪波动"},
            {"name": "周行简", "persona": "理性、计划型，承担安全与判断压力"},
            {"name": "方野", "persona": "随性，但在南极逐渐意识到自然的威严"},
            {"name": "玩家", "persona": "坚毅、逻辑强，是团队的稳定核心"},
        ],
        "intro": "你正在写一部【正在发生的极地探险小说】。",
        "background": "南极大陆 · 科研探险任务",
        "env_title": "🌬️ 环境特征：",
        "env": ["极寒、强风、冰原、裂隙", "时间感模糊，白昼或极夜", "环境本身即是压力来源"],
        "cast": [
            ("林之樱", "感性、细腻，在极端环境下更容易情绪波动"),
            ("周行简", "理性、计划型，承担安全与判断压力"),
            ("方野", "随性，但在南极逐渐意识到自然的威严"),
            ("玩家", "坚毅、逻辑强，是团队的稳定核心"),
        ],
        "rules_title": "📜 叙事规则（必须遵守）：",
        "rules": [
            "system 只能用于【环境 / 动作 / 风险 / 时间变化】描述，用【】包裹",
            "人物发言格式必须是：人物名：内容",
            "每一轮必须体现【环境变化或心理变化】",
            "至少两位人物发言",
            "允许分歧、紧张和判断失误",
            "不要总结，不要解释",
            "像小说一样自然推进",
        ],
        "outro": "不要解释你在做什么，直接写小说内容。",
    },
    "africa": {
        "id": "africa",
        "title": "非洲 · 动物大迁徙",
        "opening": (
            "【非洲大草原。】\n\n"
            "清晨的地平线泛起淡淡的金色，空气中混杂着泥土、青草与水汽的气味。\n"
            "远处传来低沉而连续的蹄声，大地仿佛在缓慢地震动。\n"
            "成群的角马与斑马正沿着古老的路线移动，迁徙已经开始。\n\n"
            "你们站在越野车旁，发动机尚未启动，所有人都不自觉地压低了声音。"
        ),
        "characters": [
            {"name": "林之樱", "persona": "感性、共情能力强，容易被动物的命运触动"},
            {"name": "周行简", "persona": "理性、观察细致，关注路线、安全与时机"},
            {"name": "方野", "persona": "随性、兴奋，容易被壮观场面感染"},
            {"name": "玩家", "persona": "坚毅、冷静、逻辑强，是团队中的稳定观察者"},
        ],
        "intro": "你正在写一部【正在发生的自然探索小说】。",
        "background": "非洲 · 东非大草原 · 动物大迁徙季",
        "env_title": "🌍 环境特征：",
        "env": ["炽热的阳光、突如其来的暴雨", "河流、泥沼、捕食者的阴影", "动物的本能、自然的节律、生命的残酷与壮丽"],
        "cast": [
            ("林之樱", "感性、共情能力强，容易被动物的命运触动"),
            ("周行简", "理性、观察细致，关注路线、安全与时机"),
            ("方野", "随性、兴奋，容易被壮观场面感染"),
            ("玩家", "坚毅、冷静、逻辑强，是团队中的稳定观察者"),
        ],
        "rules_title": "📜 叙事规则（必须遵守）：",
        "rules": [
            "system 只能用于【环境 / 动物行为 / 时间变化 / 自然事件】描述，用【】包裹",
            "人物发言格式必须是：人物名：内容",
            "每一轮必须推进【迁徙进程 / 环境变化 / 观察视角】",
            "至少两位人物发言",
            "可以出现分歧、紧张、判断不同，但不要停在讨论",
            "不要总结，不要解释",
            "像纪录片与小说结合一样，自然推进",
        ],
        "outro": "不要解释你在做什么，直接写正在发生的内容。",
    },
}


def theme_choices() -> list:
    return [{"id": t["id"], "title": t["title"]} for t in THEMES.values()]


def get_theme(theme_id: str) -> Optional[dict]:
    return THEMES.get(theme_id)


def opening_text(theme: dict) -> str:
    """前端放进 history 的开场白：去掉首尾的【】。"""
    t = theme["opening"].strip()
    if t.startswith("【"):
        t = t[1:]
    if t.endswith("】"):
        t = t[:-1]
    return t


def opening_history(theme: dict) -> list:
    return [{"role": "system", "text": opening_text(theme)}]


def build_scene_prompt(theme: dict, history: list, player_input: Optional[str]) -> str:
    """与前端各 journey_themes 的 buildPrompt 输出一致。history 项：{speaker?, role?, text}。"""
    hist = "\n".join(
        f"{h.get('speaker') or ('旁白' if h.get('role') == 'system' else h.get('role'))}：{h.get('text')}"
        for h in history)
    cast = "\n".join(
        f"- {n}：{p}" + (PLAYER_NOTE if n == "玩家" else "") for n, p in theme["cast"])
    rules = "\n".join(f"{i}. {r}" for i, r in enumerate(theme["rules"], 1))
    parts = [theme["intro"], "", "📍 背景：", theme["background"], ""]
    if theme["env"]:
        parts += [theme["env_title"]] + [f"- {e}" for e in theme["env"]] + [""]
    parts += [
        "👥 人物（只能使用以下人物名，不要新增）：", cast, "",
        theme["rules_title"], rules, "",
        "📖 已发生的剧情：", hist, "",
        "🗣️ 玩家刚刚说的话：", f"「{player_input or NO_PLAYER_INPUT}」", "",
        "➡️ 请继续写接下来正在发生的事情。", theme["outro"],
    ]
    return "\n".join(parts).strip()
