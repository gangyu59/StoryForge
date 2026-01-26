(function (SF) {

    SF.ui = SF.ui || {};

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
            var label = key === current ? '✓ 正在使用' : '使用';

            html += `
                <button class="sf-choice-btn sf-llm-btn ${active}"
                    onclick="StoryForge.llm.set('${key}'); StoryForge.ui.showLLMSettings();">
                    ${label} ${key}
                </button>
            `;
        }

        html += `
                </div>
                <button class="sf-choice-btn"
                    onclick="location.reload()">
                    返回游戏
                </button>
            </div>
        `;

        main.innerHTML = html;
    };

})(StoryForge);