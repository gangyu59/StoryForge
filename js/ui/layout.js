(function (SF) {

    SF.ui = SF.ui || {};

    /**
     * 主布局渲染
     * 会根据 SF.MODE 决定显示哪些区块
     */
    SF.ui.renderLayout = function () {
        var app = document.getElementById('app');
        if (!app) return;

        var isJourney = (SF.MODE === 'journey');

        app.innerHTML = `
            <header class="sf-header">
                <!-- 左侧：可点击（Home 或 StoryForge） -->
                <button class="sf-left-btn" id="sf-left-home-btn" type="button">
                    <span id="sf-left-home-icon" class="sf-left-icon" style="display:none;">🏠</span>
                    <span id="sf-left-home-text" class="sf-left-text">StoryForge</span>
                </button>

                ${
                    isJourney
                        ? `<div class="sf-header-center sf-journey-center">
                               <span class="sf-journey-title" id="sf-journey-title">
                                   选择你的旅程
                               </span>
                           </div>`
                        : `<div class="sf-header-center">
                               <span class="sf-identity">
                                   主题：
                                   <strong id="sf-identity-text"></strong>
                               </span>
                           </div>`
                }

                <div class="sf-header-right">
                    ${
                        // Journey 也保留 spinner（由引擎控制显隐）
                        isJourney
                            ? `
                                <div id="sf-thinking-indicator" class="sf-thinking hidden">
                                    <div class="sf-arc-spinner"></div>
                                </div>
                              `
                            : `
                                <div id="sf-thinking-indicator" class="sf-thinking hidden">
                                    <div class="sf-arc-spinner"></div>
                                </div>
                                <span class="sf-status" id="sf-status">Ready</span>
                              `
                    }
                    <span class="sf-settings-btn" id="sf-settings-btn">⚙️</span>
                </div>
            </header>

            <main class="sf-main"></main>
        `;

        // 非 journey 才更新（但我们把身份文案改成主题，不影响你原逻辑）
        if (!isJourney && SF.ui.updateIdentity) {
            SF.ui.updateIdentity();
        }

        // 左上角：回 Home
        var homeBtn = document.getElementById('sf-left-home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', function () {
                // 优先走 app.goHome
                if (SF.app && typeof SF.app.goHome === 'function') {
                    SF.app.goHome();
                    return;
                }
                // 兜底：直接渲染首页
                if (SF.ui && typeof SF.ui.renderHome === 'function') {
                    SF.ui.renderHome();
                }
            });
        }

        // 设置按钮始终可用
        var btn = document.getElementById('sf-settings-btn');
        if (btn) {
            btn.addEventListener('click', function () {
                if (SF.ui.showLLMSettings) {
                    SF.ui.showLLMSettings();
                }
            });
        }
    };

    /**
     * 更新身份（仅 mission 使用）
     * 你现在不想要等级了也没关系：不会影响 journey
     */
    SF.ui.updateIdentity = function () {
        if (SF.MODE === 'journey') return;

        var el = document.getElementById('sf-identity-text');
        if (!el || !SF.world) return;

        el.textContent =
            SF.world.identityPhaseName() +
            '（Phase ' + SF.world.identityPhase + '）';
    };

    /**
     * ✅ 设置 Journey 标题（只影响 Journey Header 中央）
     */
    SF.ui.setJourneyTitle = function (title) {
        if (SF.MODE !== 'journey') return;

        var el = document.getElementById('sf-journey-title');
        if (!el) return;

        el.textContent = title || '未知旅程';
    };

    /**
     * ✅ 切换左上角显示：Home 图标 or StoryForge 文案
     * isHome=true  => 显示 StoryForge
     * isHome=false => 显示 🏠 Home
     */
    SF.ui.setHeaderLeftMode = function (isHome) {
        var icon = document.getElementById('sf-left-home-icon');
        var text = document.getElementById('sf-left-home-text');
        if (!icon || !text) return;

        if (isHome) {
            icon.style.display = 'none';
            text.style.display = 'inline';
            text.textContent = 'StoryForge';
        } else {
            icon.style.display = 'inline';
            text.style.display = 'inline';
            text.textContent = 'Home';
        }
    };

})(StoryForge);