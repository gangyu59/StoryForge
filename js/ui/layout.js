(function (SF) {

    SF.ui = SF.ui || {};

    /**
     * 手机键盘弹出时，让固定在底部的输入栏贴着键盘上沿（iOS Safari 默认会被键盘盖住）。
     * 用 visualViewport 计算键盘高度；栏被移除后自动解除监听。
     */
    SF.ui.trackKeyboard = function (bar) {
        var vv = window.visualViewport;
        if (!vv || !bar) return;
        function fit() {
            if (!document.body.contains(bar)) {
                vv.removeEventListener('resize', fit);
                vv.removeEventListener('scroll', fit);
                return;
            }
            var off = window.innerHeight - vv.height - vv.offsetTop;
            bar.style.bottom = Math.max(0, Math.round(off)) + 'px';
            if (off > 80) {                                   // 键盘出来了：把最新消息顶上来
                var main = document.querySelector('.sf-main');
                if (main) main.scrollTop = main.scrollHeight;
            }
        }
        vv.addEventListener('resize', fit);
        vv.addEventListener('scroll', fit);
        fit();
    };

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
                    <span id="sf-left-home-icon" class="sf-left-icon" style="display:none;">‹</span>
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
                    <button class="sf-icon-btn" id="sf-listen-toggle" type="button" title="常开聆听：不用按键，直接说话"></button>
                    <button class="sf-icon-btn" id="sf-voice-toggle" type="button" title="角色语音开关"></button>
                    <button class="sf-icon-btn" id="sf-settings-btn" type="button" title="设置">⚙</button>
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
                if (SF.journey && SF.journey.stop) SF.journey.stop();
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

        // 语音开关：一键静音 / 开声
        var vt = document.getElementById('sf-voice-toggle');
        function paintVoice() {
            if (!vt || !SF.voice) return;
            var on = SF.voice.get('voice');
            vt.textContent = on ? '🔊' : '🔇';
            vt.classList.toggle('is-off', !on);
        }
        if (vt) {
            paintVoice();
            vt.addEventListener('click', function () {
                SF.voice.set('voice', !SF.voice.get('voice'));
                paintVoice();
            });
        }
        SF.ui.paintVoiceToggle = paintVoice;

        // 🎙 常开聆听开关
        var lt = document.getElementById('sf-listen-toggle');
        if (lt && SF.listen) {
            SF.listen.onState(function (st) {
                lt.textContent = '🎙';
                lt.className = 'sf-icon-btn sf-listen-' + st;
                lt.title = { off: '点击开启常开聆听', error: '麦克风没打开，点击重试', listening: '正在聆听…（点击关闭）', hearing: '听到你了…', busy: '识别中…' }[st];
            });
            lt.addEventListener('click', function () {
                var turningOn = !SF.listen.isOn();
                SF.voice.set('listen', turningOn);
                SF.listen.toggle();
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
            text.textContent = '返回';
        }
    };

})(StoryForge);