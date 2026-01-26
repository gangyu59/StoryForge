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
        input.placeholder = '用一句话定义你的世界：地点、同行者、矛盾/氛围……（这里不会出现在对话里）';
        input.rows = 2;

        var btn = document.createElement('button');
        btn.className = THEME_BTN_CLASS;
        btn.textContent = '生成';

        bar.appendChild(input);
        bar.appendChild(btn);

        // 挂到 body（保证样式与对话输入一致）
        document.body.appendChild(bar);

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
        if (!ref || !ref.input) return;
        ref.input.value = text || '';
        try { ref.input.focus(); } catch (e) {}
    };

})(StoryForge);