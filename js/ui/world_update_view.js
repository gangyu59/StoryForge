(function (SF) {

    SF.ui = SF.ui || {};

    SF.ui.showWorldUpdate = function (info) {
        var main = document.querySelector('.sf-main');

        var el = document.createElement('div');
        el.className = 'sf-card sf-world-update';

        el.innerHTML = `
            <h4>⏳ 世界的变化</h4>
            <p class="sf-muted">
                在你离开的 ${info.minutes} 分钟里，
                世界悄然推进了 ${info.ticks} 个阶段。
            </p>
        `;

        main.appendChild(el);
    };

})(StoryForge);