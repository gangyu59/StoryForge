(function (SF) {

    SF.llm = SF.llm || {};

    // ===== LLM 配置（只放占位符，绝不放真实密钥） =====
    SF.llm.config = {
        deepseek: {
            apiKey: 'DEEPSEEK_API_KEY',
            baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
            model: 'ep-20251216163420-sfnk6'
        },
        ark: {
            apiKey: 'ARK_API_KEY',
            apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
            model: 'ep-20250313161944-69jw8'
        },
        doubao: {
            apiKey: 'DOUBAO_API_KEY',
            apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
            model: 'ep-20250313161944-69jw8'
        },
        claude: {
            apiKey: 'CLAUDE_API_KEY',
            apiUrl: 'https://api.anthropic.com/v1/messages',
            model: 'claude-3-5-haiku-20241022'
        },
        gemini: {
            apiKey: 'GEMINI_API_KEY',
            apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent'
        }
    };

    // 当前使用的 LLM
    SF.llm.current = {
        provider: 'ark'
    };

    // 切换 LLM（只记录选择）
    SF.llm.set = function (provider) {
        SF.llm.current.provider = provider;
        localStorage.setItem('storyforge_llm', provider);
    };

    // 🔑 启动时：读取用户密钥并覆盖占位符
    SF.llm.load = function () {
        var saved = localStorage.getItem('storyforge_llm');
        if (saved) {
            SF.llm.current.provider = saved;
        }

        for (var provider in SF.llm.config) {
            var storageKey = 'SF_LLM_KEY_' + provider.toUpperCase();
            var userKey = localStorage.getItem(storageKey);

            if (userKey) {
                SF.llm.config[provider].apiKey = userKey;
            }
        }
    };

})(StoryForge);
