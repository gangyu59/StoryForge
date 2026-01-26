(function (SF) {

    SF.llm = SF.llm || {};

    // ===== LLM 配置（前端直连，仅限本地实验） =====

    SF.llm.config = {
        deepseek: {
            apiKey: 'DEEPSEEK_API_KEY_HERE',
            baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
            model: 'ep-20251216163420-sfnk6'
        },
        ark: {
            apiKey: 'fc5def6d-547e-47ab-b70a-95e0391cbc67',
            apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
            model: 'ep-20250313161944-69jw8'
        },
        doubao: {
            apiKey: 'DOUBAO_API_KEY_HERE',
            apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
            model: 'ep-20250313161944-69jw8'
        },
        // ⚠️ Claude / Gemini：只能用 REST（不支持 Service Account 完整流程）
        claude: {
            apiKey: 'CLAUDE_API_KEY_HERE',
            apiUrl: 'https://api.anthropic.com/v1/messages',
            model: 'claude-3-5-haiku-20241022'
        },
        gemini: {
            apiKey: 'GEMINI_API_KEY_HERE',
            apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent'
        }
    };

    // 当前选择
    SF.llm.current = {
        provider: 'deepseek'
    };

    SF.llm.set = function (provider) {
        SF.llm.current.provider = provider;
        localStorage.setItem('storyforge_llm', provider);
    };

    SF.llm.load = function () {
        var saved = localStorage.getItem('storyforge_llm');
        if (saved) SF.llm.current.provider = saved;
    };

})(StoryForge);
