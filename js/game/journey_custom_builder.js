(function (SF) {

    SF.journeyCustomBuilder = {};

    /**
     * 用 AI 把用户描述 → 生成 Journey Theme 对象
     */
    SF.journeyCustomBuilder.build = function (userDescription, onSuccess, onError) {

        var prompt = `
你是一个【AI 世界构建器】。

用户将描述一个他想进入的世界。
你的任务是：把这个描述转化为一个【可用于互动小说的世界设定】。

⚠️ 输出必须是 JSON，不能有多余解释。

JSON 格式如下（字段必须完整）：

{
  "id": "custom_xxx",
  "title": "世界名称",
  "opening": "【开场环境描写】",
  "characters": [
    {
      "name": "角色名",
      "persona": "一句话性格"
    }
  ],
  "rules": [
    "规则1",
    "规则2"
  ]
}

规则说明：
1. opening 必须是 system 描述，用【】包裹
2. characters 固定 4 个，其中一个叫“玩家”
3. 风格偏小说、电影感
4. 不要太抽象，要具体、可展开

用户描述的世界是：
「${userDescription}」
        `.trim();

        SF.llm.call(
            prompt,
            function (text) {
                try {
                    var json = JSON.parse(text);
                    var theme = buildThemeFromJSON(json);
                    onSuccess(theme);
                } catch (e) {
                    onError && onError('生成失败，请换种说法再试');
                }
            },
            function (err) {
                onError && onError(err);
            }
        );
    };

    /**
     * 把 AI JSON 转成 Journey Theme
     */
    function buildThemeFromJSON(json) {

        var themeId = 'custom_' + Date.now();

        return {
            id: themeId,
            title: json.title || '未知世界',

            opening: json.opening,

            buildPrompt: function (history, playerInput) {
                return `
你正在写一部【正在发生的互动小说】。

📍 世界背景：
${json.title}

👥 人物（只能使用以下名字，不要新增）：
${json.characters.map(c => `- ${c.name}：${c.persona}`).join('\n')}

📜 叙事规则：
${json.rules.map(r => '- ' + r).join('\n')}

📖 已发生的剧情：
${history.map(h => `${h.role}：${h.text}`).join('\n')}

🗣️ 玩家刚刚说：
「${playerInput || '（沉默）'}」

➡️ 请继续写正在发生的事情。
不要解释，直接写故事内容。
                `.trim();
            }
        };
    }

})(StoryForge);