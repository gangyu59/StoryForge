(function (SF) {

    SF.ui = SF.ui || {};

    // =============================
    // Theme 定义输入（只用于“生成世界”）
    // 与旅程对话输入彻底分离
    // =============================

    var THEME_BAR_CLASS = 'sf-input-bar sf-theme-input-bar';
    var THEME_INPUT_CLASS = 'sf-input sf-theme-input';
    var THEME_BTN_CLASS = 'sf-send-btn sf-theme-send-btn';

    function removeExisting() {
        var old = document.querySelector('.sf-theme-input-bar');
        if (old) old.remove();
    }

    function createBar() {
        removeExisting();

        var bar = document.createElement('div');
        bar.className = THEME_BAR_CLASS;

        var input = document.createElement('textarea');
        input.className = THEME_INPUT_CLASS;
        input.placeholder = '一句话描述你想去的世界…';
        input.rows = 2;
        input.enterKeyHint = 'go';

        var btn = document.createElement('button');
        btn.className = THEME_BTN_CLASS;
        btn.textContent = '生成';

        bar.appendChild(input);
        bar.appendChild(btn);

        // 挂到 body（保证样式与对话输入一致）
        document.body.appendChild(bar);
        if (SF.ui.trackKeyboard) SF.ui.trackKeyboard(bar);

        return { bar: bar, input: input, btn: btn };
    }

    /**
     * 显示 Theme 输入框（只用于自定义主题页面）
     * options:
     *  - onSubmit(text)
     */
    SF.ui.showThemeInput = function (options) {
        options = options || {};

        var ui = createBar();

        // 暴露一个句柄，方便“船卡片”填充输入
        SF.ui._themeInputRef = ui;

        function submit() {
            if (SF.ui._themeBusy) return;          // 生成中：只允许点一次
            var text = (ui.input.value || '').trim();
            if (!text) return;

            // 只用于定义主题：不渲染、不进对话、不进 history、不进 queue
            if (options.onSubmit) options.onSubmit(text);
        }

        ui.btn.onclick = submit;

        // Enter 提交（Shift+Enter 换行）
        ui.input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
            }
        });

        // 默认聚焦
        setTimeout(function () {
            try { ui.input.focus(); } catch (e) {}
        }, 0);
    };

    // ===== 生成中：沙漏等待层，并锁住输入，防止重复提交 =====
    var HINTS = ['正在构思这个世界…', '正在为三位朋友设定性格…', '正在布置开场的画面…', '马上就好，朋友们正在赶来…'];
    var hintTimer = null;

    SF.ui._themeBusy = false;

    SF.ui.showThinking = function () {
        SF.ui._themeBusy = true;
        var ref = SF.ui._themeInputRef;
        if (ref) {
            ref.input.disabled = true;
            ref.btn.disabled = true;
            ref.btn.textContent = '生成中…';
        }
        SF.ui.hideThinking(true);   // 保证只有一个等待层
        SF.ui._themeBusy = true;

        var ov = document.createElement('div');
        ov.className = 'sf-wait-mask';
        ov.id = 'sf-wait-mask';
        ov.innerHTML =
            '<div class="sf-wait-card">' +
              '<div class="sf-hourglass">⏳</div>' +
              '<div class="sf-wait-title">正在搭建你们的世界</div>' +
              '<div class="sf-wait-hint" id="sf-wait-hint">' + HINTS[0] + '</div>' +
              '<div class="sf-wait-sub">通常需要 10～20 秒，请稍等，不用重复点击</div>' +
            '</div>';
        document.body.appendChild(ov);

        var i = 0;
        hintTimer = setInterval(function () {
            i = Math.min(i + 1, HINTS.length - 1);
            var h = document.getElementById('sf-wait-hint');
            if (h) h.textContent = HINTS[i];
        }, 4500);
    };

    SF.ui.hideThinking = function (keepBusy) {
        clearInterval(hintTimer);
        var ov = document.getElementById('sf-wait-mask');
        if (ov) ov.remove();
        if (keepBusy === true) return;
        SF.ui._themeBusy = false;
        var ref = SF.ui._themeInputRef;
        if (ref) {
            ref.input.disabled = false;
            ref.btn.disabled = false;
            ref.btn.textContent = '生成';
        }
    };

    SF.ui.toast = function (msg) {
        var t = document.createElement('div');
        t.className = 'sf-toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function () { t.classList.add('out'); }, 3500);
        setTimeout(function () { t.remove(); }, 4100);
    };

    /**
     * 隐藏 Theme 输入框（生成成功后必须消失）
     */
    SF.ui.hideThemeInput = function () {
        removeExisting();
        SF.ui._themeInputRef = null;
    };

    /**
     * 给“船卡片”用：设置 Theme 输入内容并聚焦
     */
    SF.ui.setThemeInputValue = function (text) {
        var ref = SF.ui._themeInputRef;
        if (!ref || !ref.input || SF.ui._themeBusy) return;
        ref.input.value = text || '';
        try { ref.input.focus(); } catch (e) {}
    };

})(StoryForge);