"""外部控制器接口测试。LLM 全部 mock；不依赖 httpx，直接调用路由函数。"""
import asyncio
import json
import unittest
from unittest import mock

from fastapi import HTTPException

from server import routes_ext as ext
from server import themes


def run(coro):
    return asyncio.run(coro)


GOOD_WORLD = {
    "id": "custom_xxx", "title": "雨夜海边小镇", "opening": "【雨落在海面上。】",
    "characters": [
        {"name": "沈岚", "gender": "女", "persona": "安静"},
        {"name": "陈海", "gender": "男", "persona": "爽朗"},
        {"name": "老周", "gender": "男", "persona": "沉稳"},
        {"name": "玩家", "gender": "", "persona": "好奇"},
    ],
    "rules": ["规则1", "规则2"],
}


async def finish(payload, llm_text=None, llm_exc=None):
    """创建任务，mock 掉 LLM，等它跑完，返回公开的任务状态。"""
    async def fake(system, prompt, model, timeout):
        if llm_exc:
            raise llm_exc
        return llm_text
    with mock.patch.object(ext, "_call_claude", fake):
        jid = ext.create_job_from(payload)["job_id"]
        await asyncio.gather(*list(ext._tasks))
    return ext.get_job(jid)


class Base(unittest.TestCase):
    def setUp(self):
        ext.JOBS.clear()


class CatalogTest(Base):
    def test_theme_enum_is_dynamic(self):
        jobs = {j["id"]: j for j in ext.catalog()["jobs"]}
        self.assertEqual(set(jobs), {"world", "scene"})
        enum = next(p for p in jobs["scene"]["params"] if p["name"] == "theme")["enum"]
        self.assertEqual(enum, [{"id": t["id"], "title": t["title"]} for t in themes.THEMES.values()])
        self.assertEqual({e["id"] for e in enum}, {"kyoto", "antarctica", "africa"})
        with mock.patch.dict(themes.THEMES, {"x": {"id": "x", "title": "新"}}):
            enum = next(p for p in ext.catalog()["jobs"][1]["params"] if p["name"] == "theme")["enum"]
            self.assertIn({"id": "x", "title": "新"}, enum)

    def test_world_params(self):
        w = ext.catalog()["jobs"][0]
        self.assertEqual(w["params"][0]["max_length"], 300)
        self.assertTrue(w["consumes_claude"])


class ValidationTest(Base):
    def post(self, payload):
        async def go():
            return ext.create_job_from(payload)
        with mock.patch.object(ext, "_call_claude", mock.AsyncMock(return_value="")):
            try:
                return run(go())
            except HTTPException as e:
                return e

    def test_unknown_kind(self):
        self.assertEqual(self.post({"kind": "nope", "params": {}}).status_code, 400)

    def test_extra_fields(self):
        self.assertEqual(self.post({"kind": "world", "params": {"description": "x", "foo": 1}}).status_code, 400)
        self.assertEqual(self.post({"kind": "world", "params": {"description": "x"}, "extra": 1}).status_code, 400)
        self.assertEqual(self.post({"kind": "scene", "params": {"theme": "kyoto", "bar": 1}}).status_code, 400)

    def test_too_long_and_missing(self):
        self.assertEqual(self.post({"kind": "world", "params": {"description": "字" * 301}}).status_code, 400)
        self.assertEqual(self.post({"kind": "world", "params": {}}).status_code, 400)
        self.assertEqual(self.post({"kind": "world", "params": {"description": "  "}}).status_code, 400)
        self.assertEqual(self.post({"kind": "scene", "params": {"theme": "kyoto", "player_input": "字" * 301}}).status_code, 400)

    def test_unknown_theme_422(self):
        self.assertEqual(self.post({"kind": "scene", "params": {"theme": "mars"}}).status_code, 422)

    def test_unknown_job_404(self):
        with self.assertRaises(HTTPException) as c:
            ext.get_job("nope")
        self.assertEqual(c.exception.status_code, 404)


class ConcurrencyTest(Base):
    def test_409_while_running(self):
        async def go():
            gate = asyncio.Event()

            async def slow(system, prompt, model, timeout):
                await gate.wait()
                return json.dumps(GOOD_WORLD)
            with mock.patch.object(ext, "_call_claude", slow):
                jid = ext.create_job_from({"kind": "world", "params": {"description": "海"}})["job_id"]
                with self.assertRaises(HTTPException) as c:
                    ext.create_job_from({"kind": "scene", "params": {"theme": "kyoto"}})
                self.assertEqual(c.exception.status_code, 409)
                self.assertEqual(ext.get_job(jid)["status"], "running")
                self.assertEqual(ext.get_job(jid)["progress"], 0.0)
                gate.set()
                await asyncio.gather(*list(ext._tasks))
            self.assertEqual(ext.get_job(jid)["status"], "done")
            # 结束后可以再开
            with mock.patch.object(ext, "_call_claude", mock.AsyncMock(return_value="【a】")):
                ext.create_job_from({"kind": "scene", "params": {"theme": "kyoto"}})
                await asyncio.gather(*list(ext._tasks))
        run(go())

    def test_keeps_at_most_50(self):
        async def go():
            for _ in range(55):
                await finish({"kind": "scene", "params": {"theme": "kyoto"}}, "【a】")
            self.assertLessEqual(len(ext.JOBS), 51)
        run(go())


class WorldTest(Base):
    def world(self, text):
        return run(finish({"kind": "world", "params": {"description": "雨夜的海边小镇"}}, text))

    def test_ok(self):
        j = self.world("```json\n" + json.dumps(GOOD_WORLD, ensure_ascii=False) + "\n```")
        self.assertEqual(j["status"], "done")
        self.assertEqual((j["progress"], j["phase"]), (1.0, "完成"))
        r = j["result"]
        self.assertEqual(r["id"], "custom_" + j["job_id"])
        self.assertEqual(r["characters"][0], {"name": "沈岚", "persona": "安静"})
        self.assertEqual(r["rules"], ["规则1", "规则2"])
        self.assertTrue(r["disclaimer"])

    def test_missing_characters(self):
        w = dict(GOOD_WORLD, characters=GOOD_WORLD["characters"][:3])
        j = self.world(json.dumps(w, ensure_ascii=False))
        self.assertEqual(j["status"], "error")
        self.assertEqual(j["error_message"], "生成的世界缺少 4 个角色，请换种说法再试")

    def test_missing_player(self):
        chars = [dict(c) for c in GOOD_WORLD["characters"]]
        chars[3]["name"] = "路人"
        j = self.world(json.dumps(dict(GOOD_WORLD, characters=chars), ensure_ascii=False))
        self.assertEqual(j["status"], "error")
        self.assertIn("玩家", j["error_message"])

    def test_not_json(self):
        j = self.world("抱歉，我没法生成")
        self.assertEqual(j["status"], "error")
        self.assertIn("JSON", j["error_message"])

    def test_bad_rules(self):
        j = self.world(json.dumps(dict(GOOD_WORLD, rules="不是列表"), ensure_ascii=False))
        self.assertEqual(j["status"], "error")

    def test_claude_failures_are_chinese(self):
        j = run(finish({"kind": "world", "params": {"description": "x"}}, llm_exc=RuntimeError("claude 调用超过 120 秒未返回")))
        self.assertEqual((j["status"], j["error_message"]), ("error", "生成超时，请稍后再试"))
        j = run(finish({"kind": "world", "params": {"description": "x"}}, llm_exc=ValueError("boom")))
        self.assertNotIn("boom", j["error_message"])

    def test_world_prompt_contains_description(self):
        p = ext.build_world_prompt("雨夜")
        self.assertIn("「雨夜」", p)
        self.assertIn('"id": "custom_xxx"', p)


class SceneTest(Base):
    def test_parse_lines(self):
        text = "【樱花落在肩头。】\n林之樱：「好美啊！」\n周行简: 先看地图\n他停了一下\n- 方野：走吧\n系统：风起了"
        self.assertEqual(ext.parse_scene(text), [
            {"speaker": "旁白", "text": "樱花落在肩头。"},
            {"speaker": "林之樱", "text": "好美啊！"},
            {"speaker": "周行简", "text": "先看地图"},
            {"speaker": "周行简", "text": "他停了一下"},   # 续行归到上一个说话者
            {"speaker": "方野", "text": "走吧"},
            {"speaker": "旁白", "text": "风起了"},
        ])

    def test_continuation_without_speaker_is_narrator(self):
        self.assertEqual(ext.parse_scene("没有前文"), [{"speaker": "旁白", "text": "没有前文"}])

    def test_scene_job(self):
        seen = {}

        async def go():
            async def fake(system, prompt, model, timeout):
                seen.update(prompt=prompt, model=model)
                return "【花瓣飘落】\n方野：看！"
            with mock.patch.object(ext, "_call_claude", fake):
                jid = ext.create_job_from({"kind": "scene", "params": {"theme": "kyoto"}})["job_id"]
                await asyncio.gather(*list(ext._tasks))
            return ext.get_job(jid)
        j = run(go())
        self.assertEqual(j["status"], "done")
        r = j["result"]
        self.assertEqual((r["theme"], r["player_input"]), ("kyoto", ""))
        self.assertEqual(r["opening"], themes.opening_text(themes.THEMES["kyoto"]))
        self.assertEqual(len(r["lines"]), 2)
        self.assertEqual(r["raw"], "【花瓣飘落】\n方野：看！")
        self.assertIn("玩家还没有开口", seen["prompt"])
        self.assertIn("旁白：阳光温柔地洒在京都", seen["prompt"])
        self.assertEqual(seen["model"], ext._models()[0])

    def test_opening_false(self):
        j = run(finish({"kind": "scene", "params": {"theme": "africa", "opening": False, "player_input": "看河"}}, "方野：哇"))
        self.assertIsNone(j["result"]["opening"])
        self.assertEqual(j["result"]["player_input"], "看河")

    def test_empty_output_is_error(self):
        j = run(finish({"kind": "scene", "params": {"theme": "kyoto"}}, "  \n \n"))
        self.assertEqual(j["status"], "error")
        self.assertTrue(j["error_message"])


class PromptTest(unittest.TestCase):
    def test_all_themes_render(self):
        for t in themes.THEMES.values():
            p = themes.build_scene_prompt(t, themes.opening_history(t), "你好")
            self.assertIn("「你好」", p)
            self.assertIn("玩家：", p)
            self.assertEqual(sum(1 for c in t["characters"]), 4)


class OverviewTest(unittest.TestCase):
    def test_no_llm_called(self):
        with mock.patch.object(ext, "_call_claude", side_effect=AssertionError("不应调用")) as m, \
                mock.patch("server.claude_cli.stream_claude", side_effect=AssertionError("不应调用")):
            o = ext.overview()
        m.assert_not_called()
        self.assertEqual([t["id"] for t in o["themes"]], ["kyoto", "antarctica", "africa"])
        self.assertEqual(o["themes"][0]["characters"], ["林之樱", "周行简", "方野", "玩家"])
        self.assertEqual(o["roles"], ["sakura", "jerry", "kevin", "michelle", "narrator"])
        self.assertEqual(set(o["models"]), {"play", "build"})
        for k in ("tts", "stt", "claude"):
            self.assertIsInstance(o[k], bool)
        self.assertIn("stt_state", o)


if __name__ == "__main__":
    unittest.main()
