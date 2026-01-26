(function (SF) {

    SF.ui = SF.ui || {};

    // 哪些 LLM 需要用户输入 Key，以及提示文案
    var LLM_KEY_LABELS = {
        ark: '请输入 ARK API 密钥',
        deepseek: '请输入 DeepSeek API 密钥',
        doubao: '请输入 豆包 API 密钥',
        claude: '请输入 Claude API 密钥',
        gemini: '请输入 Gemini API 密钥'
    };

    function storageKey(provider) {
        return 'SF_LLM_KEY_' + provider.toUpperCase();
    }

    function getStoredKey(provider) {
        return localStorage.getItem(storageKey(provider)) || '';
    }

    function saveKey(provider, key) {
        localStorage.setItem(storageKey(provider), key);
        // 🔥 立刻覆盖运行时配置
        SF.llm.config[provider].apiKey = key;
    }

    SF.ui.showLLMSettings = function () {
        var main = document.querySelector('.sf-main');
        var current = SF.llm.current.provider;

        var html = `
            <div class="sf-card">
                <h3>AI 模型设置</h3>
                <p class="sf-muted">
                    当前模型：<strong>${current}</strong>
                </p>

                <div class="sf-llm-list">
        `;

        for (var key in SF.llm.config) {
            var active = key === current ? 'active' : '';
            var label = key === current ? '✓ 正在使用' : '选择';

            html += `
                <button class="sf-choice-btn sf-llm-btn ${active}"
                    onclick="StoryForge.ui._onSelectLLM('${key}')">
                    ${label} ${key}
                </button>
            `;
        }

        html += `</div>`;

        // 如果该 LLM 需要 Key，显示输入框
        if (LLM_KEY_LABELS[current]) {
            var savedKey = getStoredKey(current);

            html += `
                <div class="sf-llm-key-box">
                    <label class="sf-muted">${LLM_KEY_LABELS[current]}</label>
                    <input
                        id="sf-llm-key-input"
                        type="password"
                        class="sf-input"
                        placeholder="请输入你的密钥"
                        value="${savedKey}"
                    />
                    <button class="sf-choice-btn sf-confirm-btn" onclick="StoryForge.ui._onSaveLLMKey('${current}'); location.reload();">
										    保存密码并返回游戏
										</button>
                </div>
            `;
        };

        main.innerHTML = html;
    };

    // 点击选择某个 LLM
    SF.ui._onSelectLLM = function (provider) {
        SF.llm.set(provider);
        SF.ui.showLLMSettings();
    };

    // 保存 Key，并立刻生效
    SF.ui._onSaveLLMKey = function (provider) {
        var input = document.getElementById('sf-llm-key-input');
        if (!input) return;

        var key = input.value.trim();
        if (!key) {
            alert('密钥不能为空');
            return;
        }

        saveKey(provider, key);
        SF.llm.set(provider);

        // alert('密钥已保存，已切换至 ' + provider);
        SF.ui.showLLMSettings();
    };

})(StoryForge);
