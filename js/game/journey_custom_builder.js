(function (SF) {

    SF.journeyCustomBuilder = {};

    // ===== 性别：头像是固定的（1 女 2 男），必须按性别分配，否则会出现“女名配男头像” =====
    var FEMALE_TXT = /女|她|姑娘|少女|母亲|妈|姐|妹|奶奶|婆|夫人|公主|王后|修女|尼姑|太太/;
    var MALE_TXT = /男|他|老人|喇嘛|僧|和尚|先生|爷|叔|哥|弟|父亲|王子|国王|少年|船长|将军|大叔/;
    var FEMALE_NAME_END = /[玛娜莉婷雪芳梅兰琳妮瑶萱雅姬莎蕾薇妍琪岚]$/;

    SF.journeyCustomBuilder.inferGender = function (c) {
        if (c.gender === '女' || c.gender === '男') return c.gender;
        var t = (c.persona || '');
        if (FEMALE_TXT.test(t)) return '女';
        if (MALE_TXT.test(t)) return '男';
        if (FEMALE_NAME_END.test(c.name || '')) return '女';
        return '';
    };

    function ensureGenders(spec) {
        (spec.characters || []).forEach(function (c) {
            if (c.name === '玩家') return;
            c.gender = SF.journeyCustomBuilder.inferGender(c);
        });
        return spec;
    }

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
      "gender": "女 或 男",
      "persona": "一句话：性格 + 这个人独特的专长或看问题的视角（如历史、自然、诗与艺术、民俗、科学、技艺）"
    }
  ],
  "rules": [
    "规则1",
    "规则2"
  ]
}

规则说明：
1. opening 必须是 system 描述，用【】包裹
2. characters 固定 4 个：其中一个叫“玩家”（gender 写空字符串）；另外 3 个必须恰好是 1 位女性、2 位男性（用 gender 字段标注“女”或“男”，名字和性格描述都要与性别相符，因为界面头像是 1 女 2 男）
3. 风格偏小说、电影感；每个角色的专长/视角要不同，让他们的交谈能带来真实的知识和洞见，而不是互相打趣
4. 不要太抽象，要具体、可展开

用户描述的世界是：
「${userDescription}」
        `.trim();

        SF.llm.call(
            prompt,
            function (text) {
                var json = SF.llm.extractJSON(text);
                if (!json || !json.characters || !json.characters.length) {
                    onError && onError('生成失败，请换种说法再试');
                    return;
                }
                try {
                    onSuccess(buildThemeFromJSON(ensureGenders(json), userDescription));
                } catch (e) {
                    onError && onError('生成失败，请换种说法再试');
                }
            },
            function (err) {
                onError && onError(err);
            },
            { model: 'smart' }
        );
    };

    /**
     * 把 AI JSON 转成 Journey Theme
     */
    /** 从保存下来的设定还原场景（保持原来的 id） */
    SF.journeyCustomBuilder.fromSpec = function (w) {
        var spec = w.spec || {};
        if (!spec.characters || !spec.opening) return null;
        var t = buildThemeFromJSON(ensureGenders(spec), w.desc || '');
        t.id = w.id;
        t.title = w.title || t.title;
        return t;
    };

    function buildThemeFromJSON(json, desc) {

        var themeId = 'custom_' + Date.now();

        return {
            id: themeId,
            custom: true,
            spec: json,          // 保存用：原始设定
            desc: desc || '',
            title: json.title || '未知世界',

            opening: json.opening,

            buildPrompt: function (history, playerInput) {
                return `
你正在写一部【正在发生的互动小说】。

📍 世界背景：
${json.title}

👥 人物（只能使用以下名字，不要新增）：
${json.characters.map(c => `- ${c.name}${c.gender ? '（' + c.gender + '）' : ''}：${c.persona}` + (c.name === '玩家' ? ' ——【真人，由用户本人扮演，你绝对不能替玩家说话或行动】' : '')).join('\n')}

📜 叙事规则：
${(json.rules || []).map(r => '- ' + r).join('\n')}

📖 已发生的剧情：
${history.map(h => `${h.speaker || (h.role === 'system' ? '旁白' : h.role)}：${h.text}`).join('\n')}

🗣️ 玩家刚刚说：
「${playerInput || '（玩家还没有开口，由朋友们自己把故事往前推）'}」

➡️ 请继续写正在发生的事情。
不要解释，直接写故事内容。
                `.trim();
            }
        };
    }

})(StoryForge);