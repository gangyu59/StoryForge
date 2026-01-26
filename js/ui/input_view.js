(function (SF) {

    if (!SF) return;

    SF.ui = SF.ui || {};

    var recognition = null;
    var selectedLanguage = 'zh-CN';

    var isRecognizing = false;
    var started = false;
    var pendingStop = false;

    var finalText = '';
    var interimText = '';
    var lastErrorCode = '';

    var startWatchdog = null;
    var endWatchdog = null;
    var holdTimer = null;
    var holdStartAt = 0;

    SF.ui.setRecognitionLanguage = function (lang) {
        if (lang) selectedLanguage = lang;
    };

    function ensureRecognition() {
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return null;

        if (!recognition) {
            recognition = new SR();
            recognition.continuous = false;
            // 关键：打开 interim，保证“能输进去”
            recognition.interimResults = true;
        }
        return recognition;
    }

    function clearTimer(t) {
        if (t) clearTimeout(t);
        return null;
    }

    function clearIntervalSafe(i) {
        if (i) clearInterval(i);
        return null;
    }

    function isIOS() {
        var ua = navigator.userAgent || '';
        return /iPhone|iPad|iPod/i.test(ua);
    }

    SF.ui.renderInputBox = function () {
        var old = document.querySelector('.sf-input-bar');
        if (old) old.remove();

        var oldOv = document.querySelector('.sf-voice-overlay');
        if (oldOv) oldOv.remove();

        // ===== 输入条 =====
        var bar = document.createElement('div');
        bar.className = 'sf-input-bar';

        // 用 div 避免 button 的系统 click 行为
        var voiceBtn = document.createElement('div');
        voiceBtn.className = 'sf-voice-btn';
        voiceBtn.setAttribute('role', 'button');
        voiceBtn.setAttribute('aria-label', '按住说话');
        // 不设置 tabindex，减少获得焦点的机会
        voiceBtn.innerHTML =
            '<svg class="sf-voice-icon" viewBox="0 0 24 24" aria-hidden="true">' +
            '  <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/>' +
            '</svg>';

        // 强力阻断 click（iOS 仍可能有系统音，但能降低触发概率）
        voiceBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
        }, true);

        var input = document.createElement('textarea');
        input.className = 'sf-input';
        input.placeholder = '说点你的想法…';

        var sendBtn = document.createElement('button');
        sendBtn.className = 'sf-send-btn';
        sendBtn.type = 'button';
        sendBtn.textContent = '发送';

        sendBtn.onclick = function () {
            var text = (input.value || '').trim();
            if (!text) return;
            input.value = '';
            if (SF.journey && SF.journey.onPlayerInput) {
                SF.journey.onPlayerInput(text);
            }
        };

        // ===== overlay =====
        var overlay = document.createElement('div');
        overlay.className = 'sf-voice-overlay';
        overlay.innerHTML =
            '<div class="sf-voice-overlay-card">' +
            '  <div class="sf-voice-overlay-title" id="sfVoiceTitle">按住说话</div>' +
            '  <div class="sf-voice-eq" aria-hidden="true">' +
            '    <span></span><span></span><span></span><span></span><span></span>' +
            '  </div>' +
            '  <div class="sf-voice-overlay-sub" id="sfVoiceSub">松开结束</div>' +
            '  <div class="sf-voice-overlay-text" id="sfVoiceText"></div>' +
            '  <div class="sf-voice-overlay-hint" id="sfVoiceHint"></div>' +
            '</div>';

        document.body.appendChild(overlay);

        var $title = overlay.querySelector('#sfVoiceTitle');
        var $sub = overlay.querySelector('#sfVoiceSub');
        var $text = overlay.querySelector('#sfVoiceText');
        var $hint = overlay.querySelector('#sfVoiceHint');

        function showOverlay() { overlay.style.display = 'flex'; }
        function hideOverlay() {
            overlay.style.display = 'none';
            overlay.classList.remove('is-recording');
            voiceBtn.classList.remove('is-recording');
        }
        function setRecordingUI(on) {
            if (on) {
                overlay.classList.add('is-recording');
                voiceBtn.classList.add('is-recording');
            } else {
                overlay.classList.remove('is-recording');
                voiceBtn.classList.remove('is-recording');
            }
        }
        function setHint(t) { $hint.textContent = t || ''; }
        function setOverlayText(t) { $text.textContent = (t || '').trim(); }

        function fillInputLive(t) {
            var s = (t || '').trim();
            if (!s) return;
            input.value = s;
            // 不强制 focus，避免 iOS 点按音/键盘弹起
        }

        function startHoldTick() {
            holdTimer = clearIntervalSafe(holdTimer);
            holdStartAt = Date.now();
            holdTimer = setInterval(function () {
                var s = Math.floor((Date.now() - holdStartAt) / 1000);
                $sub.textContent = '松开结束 · ' + s + 's';
            }, 250);
        }

        function stopHoldTick() {
            holdTimer = clearIntervalSafe(holdTimer);
        }

        function resetSessionFlags() {
            finalText = '';
            interimText = '';
            lastErrorCode = '';
            started = false;
            pendingStop = false;
            isRecognizing = false;

            startWatchdog = clearTimer(startWatchdog);
            endWatchdog = clearTimer(endWatchdog);
        }

        function attachRecognitionHandlers(rec) {
            rec.onstart = function () {
                started = true;
                if (pendingStop) {
                    pendingStop = false;
                    try { rec.stop(); } catch (e) {}
                }
            };

            rec.onresult = function (event) {
                var f = '';
                var it = '';

                try {
                    for (var i = event.resultIndex; i < event.results.length; i++) {
                        var r = event.results[i];
                        var s = (r[0] && r[0].transcript) ? r[0].transcript : '';
                        if (r.isFinal) f += s;
                        else it += s;
                    }
                } catch (e) {}

                if (f) finalText += f;
                interimText = it;

                var merged = (finalText + interimText).trim();
                if (merged) {
                    setOverlayText(merged);
                    fillInputLive(merged); // 关键：实时写入输入框
                }
            };

            rec.onerror = function (e) {
                var code = (e && (e.error || e.name)) ? (e.error || e.name) : 'unknown';
                var msg  = (e && (e.message || e.type)) ? (e.message || e.type) : '';
                lastErrorCode = code;

                try {
                    console.error('[SF][VOICE] recognition error code=', code, 'msg=', msg, 'raw=', e);
                } catch (err) {}

                isRecognizing = false;
                started = false;

                startWatchdog = clearTimer(startWatchdog);
                endWatchdog = clearTimer(endWatchdog);

                if (code === 'service-not-allowed' || code === 'not-allowed') {
                    $title.textContent = '系统限制';
                    setHint('SpeechRecognition 在该环境受限。要稳定请走 MediaRecorder + STT。');
                } else if (code === 'no-speech') {
                    $title.textContent = '没听清';
                    setHint('请靠近麦克风再试一次。');
                } else {
                    $title.textContent = '识别失败';
                    setHint('错误：' + code + (msg ? (' / ' + msg) : ''));
                }

                setTimeout(function () { hideOverlay(); }, 900);
            };

            rec.onend = function () {
                isRecognizing = false;
                started = false;

                startWatchdog = clearTimer(startWatchdog);
                endWatchdog = clearTimer(endWatchdog);

                var merged = (finalText + interimText).trim();

                if (merged) {
                    $title.textContent = '识别完成';
                    setOverlayText(merged);
                    // 最终再写一次，确保落盘
                    input.value = merged;
                    setHint('已填入输入框，可编辑后发送。');
                } else {
                    $title.textContent = '未识别到文字';
                    if (lastErrorCode) setHint('错误：' + lastErrorCode);
                    else setHint('请再试一次：按住说话，松开结束。');
                }

                setTimeout(function () { hideOverlay(); }, 800);
            };
        }

        function startRecognition() {
            var rec = ensureRecognition();
            if (!rec) {
                $title.textContent = '不支持';
                setHint('当前浏览器不支持 SpeechRecognition。');
                return false;
            }

            // 清理残留会话
            try { rec.abort(); } catch (e) {}

            resetSessionFlags();
            attachRecognitionHandlers(rec);

            rec.lang = selectedLanguage || 'zh-CN';

            try {
                isRecognizing = true;
                rec.start();
            } catch (e) {
                isRecognizing = false;
                try { console.error('[SF][VOICE] start failed', e); } catch (err) {}
                $title.textContent = '无法启动';
                setHint('启动识别失败，请重试。');
                return false;
            }

            // onstart 看门狗
            startWatchdog = clearTimer(startWatchdog);
            startWatchdog = setTimeout(function () {
                if (!started && isRecognizing) {
                    try { rec.abort(); } catch (e) {}
                    isRecognizing = false;
                    $title.textContent = '启动超时';
                    setHint('识别服务未响应，请重试。');
                    setTimeout(function () { hideOverlay(); }, 800);
                }
            }, 700);

            // 总时长看门狗
            endWatchdog = clearTimer(endWatchdog);
            endWatchdog = setTimeout(function () {
                if (isRecognizing) {
                    try { rec.stop(); } catch (e) {}
                }
            }, 12000);

            return true;
        }

        function stopRecognitionDelayed() {
            var rec = recognition;
            if (!rec) return;

            // 延迟 stop：给 Safari 最后一点时间把音频片段落到 onresult
            setTimeout(function () {
                if (!rec) return;

                if (!started && isRecognizing) {
                    pendingStop = true;
                    return;
                }
                if (isRecognizing) {
                    try { rec.stop(); } catch (e) {}
                }
            }, 180);
        }

        // ===== 按住 / 松开 =====
        var isHolding = false;

        function startHold(e) {
            if (isHolding) return;
            isHolding = true;

            // 关键：避免产生“焦点/点击”类反馈音
            try { if (document.activeElement) document.activeElement.blur(); } catch (err) {}

            if (e && e.preventDefault) e.preventDefault();
            if (e && e.stopPropagation) e.stopPropagation();

            setRecordingUI(true);
            $title.textContent = '识别中…';
            $sub.textContent = '松开结束';
            setOverlayText('');
            setHint('');
            showOverlay();
            startHoldTick();

            var ok = startRecognition();
            if (!ok) {
                stopHoldTick();
                setRecordingUI(false);
                isHolding = false;
                setTimeout(function () { hideOverlay(); }, 900);
            }
        }

        function endHold(e) {
            if (!isHolding) return;
            isHolding = false;

            if (e && e.preventDefault) e.preventDefault();
            if (e && e.stopPropagation) e.stopPropagation();

            stopHoldTick();
            setRecordingUI(false);

            stopRecognitionDelayed();
        }

        // iOS：只绑定 touch，减少合成 click 及系统反馈音触发概率
        function bindHoldEvents(el) {
            if (isIOS()) {
                el.addEventListener('touchstart', startHold, { passive: false });
                window.addEventListener('touchend', endHold, { passive: false });
                window.addEventListener('touchcancel', endHold, { passive: false });
            } else if (window.PointerEvent) {
                el.addEventListener('pointerdown', startHold, { passive: false });
                window.addEventListener('pointerup', endHold, { passive: false });
                window.addEventListener('pointercancel', endHold, { passive: false });
            } else {
                el.addEventListener('mousedown', startHold);
                window.addEventListener('mouseup', endHold);
            }

            el.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
        }

        bindHoldEvents(voiceBtn);

        // ===== 挂载 =====
        bar.appendChild(voiceBtn);
        bar.appendChild(input);
        bar.appendChild(sendBtn);
        document.body.appendChild(bar);

        hideOverlay();
    };

})(window.StoryForge);