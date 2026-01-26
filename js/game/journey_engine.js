(function (SF) {

    SF.journey = SF.journey || {};

    // ================= 全局状态 =================
    var history = [];
    var queue = [];
    var isThinking = false;

    var typingSpeed = 24;

    var idleTimer = null;
    var IDLE_DELAY = 45000;

    var currentTheme = null;

    // ================= 固定主题：严格固定映射（不允许被污染） =================
    var FIXED_NAME_TO_ROLE = {
        '林之樱': 'sakura',
        '周行简': 'jerry',
        '方野': 'kevin',
        '你': 'michelle',
        '玩家': 'michelle',
        'Michelle': 'michelle'
    };

    function isCustomTheme() {
        // 约定：你自定义 builder 生成的 theme.id 通常是 custom_* 或者 theme.custom = true
        // 这里做一个兼容：只要主题显式标记 custom 或 id 以 custom 开头，就启用自定义映射
        if (!currentTheme) return false;
        if (currentTheme.custom === true) return true;
        if (typeof currentTheme.id === 'string' && currentTheme.id.indexOf('custom') === 0) return true;
        return false;
    }

    // ================= 自定义主题：AI 名字 -> 4 槽位（一次性映射后固化） =================
    // 槽位就是你现有四个角色头像：sakura / jerry / kevin / michelle
    var customNameToRole = {};               // AI speaker -> role
    var customRoleToName = {                 // role -> AI speaker（用于“固化”，避免同一角色被多个名字抢占）
        sakura: null,
        jerry: null,
        kevin: null,
        michelle: null
    };
    var CUSTOM_ROLE_ORDER = ['sakura', 'jerry', 'kevin', 'michelle'];

    function resetCustomMapping() {
        customNameToRole = {};
        customRoleToName = { sakura: null, jerry: null, kevin: null, michelle: null };
    }

    function normalizeSpeaker(s) {
        if (!s) return '';
        return String(s).replace(/\s+/g, ' ').trim();
    }

    function allocRoleForCustomSpeaker(speaker) {
        speaker = normalizeSpeaker(speaker);
        if (!speaker) return 'sakura';

        // 已映射则直接返回
        if (customNameToRole[speaker]) return customNameToRole[speaker];

        // 找一个空槽位
        for (var i = 0; i < CUSTOM_ROLE_ORDER.length; i++) {
            var role = CUSTOM_ROLE_ORDER[i];
            if (!customRoleToName[role]) {
                customRoleToName[role] = speaker;
                customNameToRole[speaker] = role;
                return role;
            }
        }

        // 超过 4 个名字：兜底复用（理论上你说不会超过四个，这里防御）
        // 复用第一个角色槽位
        customNameToRole[speaker] = 'sakura';
        return 'sakura';
    }

    // ================= 工具 =================
    function scrollBottom() {
        var main = document.querySelector('.sf-main');
        if (!main) return;
        requestAnimationFrame(function () {
            main.scrollTop = main.scrollHeight;
        });
    }

    // ================= 打字机 =================
    function playQueue() {
        if (queue.length === 0) {
            isThinking = false;
            clearTimeout(idleTimer);
            idleTimer = setTimeout(triggerIdleIfSafe, IDLE_DELAY);
            return;
        }

        var msg = queue.shift();

        // ✅ system：永远纯描述，不进气泡
        if (msg.role === 'system') {
            SF.ui.renderDialogue(msg);
            scrollBottom();
            playQueue();
            return;
        }

        // 人物：打字机
        var buffer = '';
        var i = 0;

        SF.ui.renderDialogue({
            role: msg.role,
            text: '',
            // ✅ 自定义主题：气泡上方显示 AI 名字（固定主题则为空）
            displayName: msg.displayName || null
        });

        var timer = setInterval(function () {
            buffer += msg.text[i++] || '';
            SF.ui.updateLastDialogue(buffer);
            scrollBottom();

            if (i >= msg.text.length) {
                clearInterval(timer);
                setTimeout(playQueue, 80);
            }
        }, typingSpeed);
    }

    // ================= 解析 AI 输出 =================
    function parseAI(text) {
        var out = [];
        if (!text) return out;

        text.split('\n').forEach(function (raw) {
            var line = (raw || '').trim();
            if (!line) return;

            // 清理常见编号/符号，避免 “1)” “- ” 污染
            line = line.replace(/^\s*[\-\*\u2022]\s+/, '');
            line = line.replace(/^\s*\d+\)\s*/, '');
            line = line.replace(/^\s*\d+\.\s*/, '');
            line = line.trim();
            if (!line) return;

            // 1) system 描述：必须【】；如果 AI 忘了包裹，但看起来像叙述句，也兜底为 system
            if (line.startsWith('【') && line.endsWith('】')) {
                out.push({ role: 'system', text: line.slice(1, -1) });
                return;
            }

            // 2) speaker: content
            var parts = line.split(/[:：]/);
            if (parts.length >= 2) {
                var speaker = normalizeSpeaker(parts[0]);
                var content = parts.slice(1).join('：').trim();

                // speaker 是 system/系统 => 描述
                if (speaker.toLowerCase() === 'system' || speaker === '系统') {
                    out.push({ role: 'system', text: content || line });
                    return;
                }

                // ✅ 固定主题：严格按固定映射（不允许出现“AI 新名字”破坏）
                if (!isCustomTheme()) {
                    var fixedRole = FIXED_NAME_TO_ROLE[speaker];
                    if (fixedRole) {
                        out.push({
                            role: fixedRole,
                            text: content,
                            displayName: null
                        });
                    } else {
                        // 固定主题中出现未知名字：当作 system 叙述（避免污染气泡/头像）
                        out.push({
                            role: 'system',
                            text: line
                        });
                    }
                    return;
                }

                // ✅ 自定义主题：未知名字 -> 四槽位映射，气泡显示 AI 名字
                var role = allocRoleForCustomSpeaker(speaker);
                out.push({
                    role: role,
                    text: content,
                    displayName: speaker
                });
                return;
            }

            // 3) 没冒号：作为 system 叙述（不进气泡）
            out.push({ role: 'system', text: line });
        });

        return out;
    }

    // ================= 玩家输入 =================
    SF.journey.onPlayerInput = function (playerText) {
        if (!playerText || isThinking || !currentTheme) return;

        clearTimeout(idleTimer);

        // ✅ 你 = Michelle：固定用 michelle 角色
        var userMsg = { role: 'michelle', text: playerText, displayName: null };
        history.push(userMsg);
        queue.push(userMsg);

        if (!isThinking) playQueue();
        if (isThinking) return;

        isThinking = true;

        var spinner = document.getElementById('sf-thinking-indicator');
        if (spinner) spinner.classList.remove('hidden');

        SF.llm.call(
            currentTheme.buildPrompt(history, playerText),
            function (text) {
                if (spinner) spinner.classList.add('hidden');

                var msgs = parseAI(text);
                msgs.forEach(function (m) {
                    history.push(m);
                    queue.push(m);
                });

                playQueue();
            },
            function () {
                if (spinner) spinner.classList.add('hidden');
                isThinking = false;
            }
        );
    };

    // ================= idle 自动推进 =================
    function triggerIdleIfSafe() {
        if (isThinking || queue.length > 0 || !currentTheme) return;

        isThinking = true;

        var spinner = document.getElementById('sf-thinking-indicator');
        if (spinner) spinner.classList.remove('hidden');

        SF.llm.call(
            currentTheme.buildPrompt(history, null),
            function (text) {
                if (spinner) spinner.classList.add('hidden');

                var msgs = parseAI(text);
                msgs.forEach(function (m) {
                    history.push(m);
                    queue.push(m);
                });

                playQueue();
            },
            function () {
                if (spinner) spinner.classList.add('hidden');
                isThinking = false;
            }
        );
    }

    // ================= 启动入口（关键） =================
    SF.journey.startWithTheme = function (themeId) {
        if (!SF.journeyThemes || !SF.journeyThemes[themeId]) {
            alert('Theme not found: ' + themeId);
            return;
        }

        // 重置状态
        currentTheme = SF.journeyThemes[themeId];
        history = [];
        queue = [];
        isThinking = false;

        clearTimeout(idleTimer);

        // ✅ 自定义主题：重置一次性映射（保证“一开始就映射，然后固化”）
        if (isCustomTheme()) {
            resetCustomMapping();
        }

        // opening：必须是 system 描述（不进气泡）
        if (currentTheme.opening) {
            var openMsg = { role: 'system', text: currentTheme.opening };
            history.push(openMsg);
            queue.push(openMsg);
            playQueue();
        }
    };

})(StoryForge);