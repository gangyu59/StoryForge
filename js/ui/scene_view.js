(function (SF) {

    SF.ui = SF.ui || {};

    // 用于中断上一次打字动画
    var typingToken = 0;

    /**
     * 渲染场景（支持打字机式剧情输出）
     */
    SF.ui.renderScene = function (scene) {
        var main = document.querySelector('.sf-main');
        if (!main) {
            console.error('sf-main not found');
            return;
        }

        // 每次渲染递增 token，用于中断旧动画
        typingToken++;
        var currentToken = typingToken;

        main.innerHTML = `
            <div class="sf-card">
                <h3>${scene.title || ''}</h3>
                <p id="sf-scene-text"></p>
                <div id="sf-choices"></div>
            </div>
        `;

        // 1️⃣ 立即渲染 choices（不等文字）
        if (SF.ui.renderChoices) {
            SF.ui.renderChoices(scene.choices || []);
        }

        // 2️⃣ 打字机式输出剧情文本
        var textEl = document.getElementById('sf-scene-text');
        if (!textEl || !scene.text) return;

        typeWriter(textEl, scene.text, currentToken);
    };

    /**
     * 打字机效果（逐字符，支持中断）
     */
    function typeWriter(el, text, token) {
        el.textContent = '';

        var i = 0;
        var speed = 18; // 每个字符间隔（ms），可自行微调

        function step() {
            // 如果有新一轮 renderScene，立刻终止
            if (token !== typingToken) return;

            if (i < text.length) {
                el.textContent += text.charAt(i);
                i++;
                setTimeout(step, speed);
            }
        }

        step();
    }

})(StoryForge);