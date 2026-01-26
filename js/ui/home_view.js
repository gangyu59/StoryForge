(function (SF) {

    SF.ui = SF.ui || {};

    SF.ui.renderHome = function () {

        var main = document.querySelector('.sf-main');
        if (!main) return;

        main.innerHTML = `
            <div class="sf-home">
                <h2 class="sf-home-title">选择你要进入的旅程</h2>

                <button class="sf-home-btn" data-theme="kyoto">
                    京都 · 赏樱之旅
                </button>

                <button class="sf-home-btn" data-theme="antarctica">
                    南极 · 探险之旅
                </button>

                <button class="sf-home-btn" data-theme="africa">
                    非洲 · 动物大迁徙
                </button>

                <button class="sf-home-btn sf-home-btn-secondary" data-theme="custom">
                    主题 · 用户自定义
                </button>

                <div class="sf-home-hint">
                    每一次选择，都是一个正在发生的世界
                </div>
            </div>
        `;

        main.querySelectorAll('.sf-home-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var themeId = btn.getAttribute('data-theme');
                SF.app.startJourney(themeId);
            });
        });
    };

})(StoryForge);