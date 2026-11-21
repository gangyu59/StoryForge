(function (SF) {

    SF.journey = SF.journey || {};

    // ================= 全局状态 =================
    var history = [];          // 已发生的剧情（供 prompt 使用）
    var queue = [];            // 待播放的消息（Claude 一行一行流式到达）
    var streaming = false;     // Claude 还在输出
    var pumping = false;       // 播放循环在运行
    var gen = 0;               // 轮次令牌：玩家打断时 +1，旧轮次的回调自动作废
    var abortStream = null;
    var held = false;          // 你正在开口：角色暂停，等你说完
    var heldTimer = null;

    var idleTimer = null;
    var IDLE_DELAY = 45000;
    var HISTORY_WINDOW = 30;   // 只把最近 N 条喂给模型，保持快速

    var currentTheme = null;

    // ================= 固定主题：严格固定映射 =================
    var FIXED_NAME_TO_ROLE = {
        '林之樱': 'sakura',
        '周行简': 'jerry',
        '方野': 'kevin',
        '你': 'michelle',
        '玩家': 'michelle',
        'Michelle': 'michelle'
    };
    var ROLE_TO_NAME = { sakura: '林之樱', jerry: '周行简', kevin: '方野', michelle: '玩家' };

    function isCustomTheme() {
        if (!currentTheme) return false;
        if (currentTheme.custom === true) return true;
        return typeof currentTheme.id === 'string' && currentTheme.id.indexOf('custom') === 0;
    }

    // ================= 自定义主题：AI 名字 -> 4 槽位（一次性映射后固化） =================
    var customNameToRole = {};
    var customRoleToName = {};
    var CUSTOM_ROLE_ORDER = ['sakura', 'jerry', 'kevin'];   // 玩家固定占 michelle 槽

    var customKnownNames = [];   // 这个世界设定里真实存在的角色名（含玩家）

    // 把 AI 写的说话人对上设定里的角色：完全一致，或是“卓玛阿姨”“丹增”这种带/省称谓的写法；对不上 → null
    function matchCustomName(speaker) {
        if (customKnownNames.indexOf(speaker) >= 0) return speaker;
        if (speaker.length < 2) return null;
        for (var i = 0; i < customKnownNames.length; i++) {
            var n = customKnownNames[i];
            if (n.length >= 2 && (speaker.indexOf(n) === 0 || n.indexOf(speaker) === 0)) return n;
        }
        return null;
    }

    function resetCustomMapping() {
        customKnownNames = (((currentTheme && currentTheme.spec && currentTheme.spec.characters) || [])
            .map(function (c) { return c && c.name ? normalizeSpeaker(c.name) : ''; }).filter(Boolean));
        customNameToRole = {};
        customRoleToName = { sakura: null, jerry: null, kevin: null, michelle: null };

        // 开场就按性别一次性分配并固化：女性 → 林之樱的头像/声音，男性 → 周行简、方野
        var chars = ((currentTheme && currentTheme.spec && currentTheme.spec.characters) || [])
            .filter(function (c) { return c && c.name && ['玩家', '你', 'Michelle'].indexOf(c.name) < 0; });
        var PREF = { '女': ['sakura', 'jerry', 'kevin'], '男': ['jerry', 'kevin', 'sakura'], '': ['sakura', 'jerry', 'kevin'] };
        ['女', '男', ''].forEach(function (g) {
            chars.filter(function (c) { return (c.gender || '') === g; }).forEach(function (c) {
                var name = normalizeSpeaker(c.name);
                var role = PREF[g].filter(function (r) { return !customRoleToName[r]; })[0];
                if (!role) return;
                customRoleToName[role] = name;
                customNameToRole[name] = role;
            });
        });
    }

    function playerName() { return (SF.voice && SF.voice.playerName()) || '\u0000'; }

    function normalizeSpeaker(s) {
        return s ? String(s).replace(/\s+/g, ' ').trim() : '';
    }

    function allocRoleForCustomSpeaker(speaker) {
        speaker = normalizeSpeaker(speaker);
        if (!speaker) return 'sakura';
        if (speaker === '玩家' || speaker === '你' || speaker === 'Michelle' || speaker === playerName()) return 'michelle';
        if (customNameToRole[speaker]) return customNameToRole[speaker];
        for (var i = 0; i < CUSTOM_ROLE_ORDER.length; i++) {
            var role = CUSTOM_ROLE_ORDER[i];
            if (!customRoleToName[role]) {
                customRoleToName[role] = speaker;
                customNameToRole[speaker] = role;
                return role;
            }
        }
        customNameToRole[speaker] = 'sakura';   // 超过 3 个名字：兜底复用
        return 'sakura';
    }

    // ================= 工具 =================
    function scrollBottom() {
        var main = document.querySelector('.sf-main');
        if (!main) return;
        requestAnimationFrame(function () { main.scrollTop = main.scrollHeight; });
    }

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    function setThinking(on) {
        var s = document.getElementById('sf-thinking-indicator');
        if (s) s.classList.toggle('hidden', !on);
    }

    // 台词里的括号动作一律去掉；模型偶尔把“格式规则”当台词念出来，也一并丢弃
    var META_LEAK = /不写括号|此行|本行|格式要求|输出格式|不要写括号/;
    function cleanSpeech(t) {
        t = String(t).trim().replace(/^[「“"]|[」”"]$/g, '');
        if (META_LEAK.test(t)) return '';
        t = t.replace(/[（(][^）)]*[）)]/g, '').replace(/\s{2,}/g, ' ').trim();
        return t;
    }

    // ================= 解析 AI 输出（一行） =================
    function parseLine(raw) {
        var line = (raw || '').trim();
        if (!line) return null;

        line = line.replace(/^\s*[\-\*•]\s+/, '')
                   .replace(/^\s*\d+[\)\.、]\s*/, '')
                   .replace(/^[#>\s]+/, '')
                   .replace(/\*/g, '')
                   .trim();
        if (!line) return null;

        if (META_LEAK.test(line)) return null;

        // system 描述：【...】
        if (line.charAt(0) === '【' && line.charAt(line.length - 1) === '】') {
            return { role: 'system', text: line.slice(1, -1) };
        }

        // 人物：内容（「」引号一并去掉）
        var m = line.match(/^([^:：]{1,12})[:：]\s*(.+)$/);
        if (m) {
            var speaker = normalizeSpeaker(m[1]);
            var content = cleanSpeech(m[2]);
            if (!content) return null;                     // 整句都是括号/元说明：丢掉

            if (speaker.toLowerCase() === 'system' || speaker === '系统' || speaker === '旁白') {
                return { role: 'system', text: content };
            }

            if (!isCustomTheme()) {
                var fixedRole = FIXED_NAME_TO_ROLE[speaker] || (speaker === playerName() ? 'michelle' : null);
                if (fixedRole) return { role: fixedRole, text: content, speaker: ROLE_TO_NAME[fixedRole] };
                return { role: 'system', text: line };   // 固定主题中的陌生名字：当旁白
            }

            if (speaker !== playerName()) {
                var canon = matchCustomName(speaker);
                if (!canon) return { role: 'system', text: line };   // 不是设定里的角色（如“远处钟声：…”“叙述者：…”）→ 旁白
                speaker = canon;
            }
            var role = allocRoleForCustomSpeaker(speaker);
            return { role: role, text: content, displayName: speaker, speaker: speaker };
        }

        return { role: 'system', text: line.replace(/^【|】$/g, '') };
    }

    // AI 写了玩家的台词，或旁白里以“玩家/你”为主语写玩家的行为 → 不是 AI 该写的，丢掉
    function speaksForPlayer(m) {
        if (m.role === 'michelle') return true;
        if (m.role === 'system') {
            var t = m.text.trim(), n = SF.voice && SF.voice.playerName();
            if (/^(玩家|你(?!们))/.test(t) || (n && t.indexOf(n) === 0)) return true;
        }
        return false;
    }

    // ================= 播放循环：一句一句，声音与文字同步 =================
    function enqueue(msg) {
        history.push(msg);
        queue.push(msg);
        // 一到达就开始取音频，播放前一句时后一句已在路上
        if (SF.voice && SF.voice.shouldSpeak(msg.role)) {
            msg.audio = SF.voice.fetch(msg.text, msg.role);
        }
        if (!pumping) pump(gen);
    }

    function typeText(text, totalMs, token) {
        return new Promise(function (resolve) {
            var i = 0;
            var step = Math.max(18, Math.min(90, totalMs / Math.max(1, text.length)));
            var timer = setInterval(function () {
                if (token !== gen) { clearInterval(timer); resolve(); return; }
                i++;
                SF.ui.updateLastDialogue(text.slice(0, i));
                scrollBottom();
                if (i >= text.length) { clearInterval(timer); resolve(); }
            }, step);
        });
    }

    async function pump(token) {
        pumping = true;
        try {
            while (token === gen) {
                while (held && token === gen) await sleep(80);
                if (token !== gen) break;
                if (queue.length === 0) {
                    if (streaming) { await sleep(60); continue; }   // 等 Claude 下一行
                    break;
                }

                var msg = queue.shift();

                if (msg.role === 'system') {
                    SF.ui.renderDialogue(msg);
                    scrollBottom();
                    if (msg.audio) {                                   // 旁白朗读（可选）
                        var nu = await msg.audio;
                        if (token === gen && nu) await SF.voice.play(nu);
                    } else {
                        await sleep(Math.min(1800, 500 + msg.text.length * 22));
                    }
                    continue;
                }

                // 人物台词
                SF.ui.renderDialogue({ role: msg.role, text: '', displayName: msg.displayName || null });
                SF.ui.setSpeaking && SF.ui.setSpeaking(true);

                var url = null;
                if (msg.audio) {
                    url = await Promise.race([msg.audio, sleep(8000).then(function () { return null; })]);
                }
                if (token !== gen) break;

                if (url) {
                    SF.voice.noteSpoken(msg.text);
                    var typing = null;
                    await SF.voice.play(url, function (dur) {
                        typing = typeText(msg.text, (dur || msg.text.length * 0.25) * 1000 * 0.92, token);
                    });
                    if (typing) await typing;
                } else {
                    await typeText(msg.text, msg.text.length * 38, token);
                }
                if (token !== gen) break;

                SF.ui.updateLastDialogue(msg.text);
                SF.ui.setSpeaking && SF.ui.setSpeaking(false);
                scrollBottom();
                await sleep(url ? 260 : 380);   // 朋友之间接话的小停顿
            }
        } finally {
            if (token === gen) {
                pumping = false;
                SF.ui.setSpeaking && SF.ui.setSpeaking(false);
                if (!streaming) armIdle();
            }
        }
    }

    // ================= 向 Claude 要下一段剧情（流式） =================
    var BASE_SUFFIX = [
        '',
        '【最高优先级规则：玩家是真人】',
        '- “玩家”由用户本人扮演。你绝对不能替玩家写台词、想法、心理、表情、动作或决定，也不要复述或改写玩家说过的话',
        '- 只写其他三位角色和周围环境；需要玩家回应时，让朋友们提问、停下来等玩家开口，然后这一轮就结束',
        '',
        '【对话品质（与格式同样重要）】',
        '- 这是一群有见识、有温度的朋友在旅途中的谈话，不是相声。每一句都要给对话增加东西：一个真实可靠的知识点（历史、地理、自然、文化、典故、科学），或一处有诗意的观察与比喻，或一个引人深思的问题',
        '- 每轮至少有 2 处这样“有料”的内容，其余是自然的接话与回应',
        '- 禁止：互相调侃、挖苦、抬杠；空洞的感叹（“哇”“你看”只能当开头，后面必须有内容）；围着吃喝买东西闲扯',
        '- 幽默可以有，但要含蓄机智、点到为止，来自对事物的观察，而不是互相损人',
        '- 后一个人要接住前一个人的话并向深处推进（补充、对照、追问），不要各说各的',
        '- 知识必须真实准确，不确定就不要写。只引用你有十足把握、确有出处的名句，并点明作者；稍有不确定就不要引用，改用自己的话描写——绝不编造诗句、典故、人物或数据',
        '- 知识要像朋友聊天，一两句话讲透并融进当下的场景，不说教、不写百科式长篇',
        '- 旁白用有画面的意象（光、声音、气味、触感、温度），不写流水账',
        '- 偶尔（不必每轮）由某位朋友抛出一个让玩家愿意回答的好问题',
        '',
        '【输出格式（必须遵守）】',
        '- 一行一句：要么是【环境/动作描写】（整行用【】包裹，不超过 50 字），要么是「人物名：台词」',
        '- 台词口语化、自然，单句不超过 50 字；台词里不要出现任何括号或动作描写，情绪靠语气和用词来表达',
        '- 本轮共写 5～8 行，台词占多数，不要加任何标题、解释或总结'
    ].join('\n');

    // 固定主题里三位朋友各有一个视角，谈话才有层次；自定义世界则按各自的人设专长来
    var LENS = [
        '',
        '【三位朋友的视角】',
        '- 林之樱：文学与审美——爱引诗词、俳句、典故，留意光影、季节与情绪',
        '- 周行简：历史、地理与科学——讲清事物的来龙去脉，用事实和因果把话说深',
        '- 方野：民俗、风物与生活——懂当地人的日常、传统和食物背后的故事，爱讲有趣的冷知识，通透而含蓄地幽默'
    ].join('\n');

    function styleSuffix() {
        if (isCustomTheme()) return BASE_SUFFIX + '\n- 让每位角色按各自人设里的专长与视角发言，三个人的角度要不同';
        return BASE_SUFFIX + LENS;
    }

    // 玩家的名字：让朋友们自然地叫出来
    function nameRule() {
        var n = SF.voice && SF.voice.playerName();
        if (!n) return '';
        return '\n【玩家的名字】玩家（真人）的名字叫「' + n + '」。朋友们要在合适的时候自然地叫 TA「' + n + '」，不要叫“玩家”；不要用性别代词称呼 TA。';
    }

    function windowHistory() { return history.slice(-HISTORY_WINDOW); }

    function requestTurn(playerText) {
        var my = gen;
        streaming = true;
        setThinking(true);

        var prompt = currentTheme.buildPrompt(windowHistory(), playerText) + '\n' + styleSuffix() + nameRule();
        var gotAny = false;

        abortStream = SF.llm.stream(prompt, {
            onLine: function (line) {
                if (my !== gen) return;
                var m = parseLine(line);
                if (!m) return;
                if (speaksForPlayer(m)) return;   // 兜底：AI 替玩家说话 / 写玩家的动作，一律丢弃
                if (!gotAny) { gotAny = true; setThinking(false); }
                enqueue(m);
            },
            onDone: function () {
                if (my !== gen) return;
                streaming = false;
                setThinking(false);
                if (!pumping) armIdle();
            },
            onError: function (msg) {
                if (my !== gen) return;
                streaming = false;
                setThinking(false);
                var tip = '（连接 Claude 失败：' + msg + '。请确认本机已登录 Claude 订阅，然后再说点什么重试。）';
                SF.ui.renderDialogue({ role: 'system', text: tip });
                if (!pumping) armIdle();
            }
        });
    }

    function armIdle() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function () {
            if (streaming || pumping || queue.length || !currentTheme) return;
            requestTurn(null);
        }, IDLE_DELAY);
    }

    function interrupt() {
        gen++;                      // 作废正在进行的一轮
        if (abortStream) { abortStream(); abortStream = null; }
        if (SF.voice) SF.voice.stop();
        queue = [];
        streaming = false;
        pumping = false;
        setThinking(false);
        SF.ui.setSpeaking && SF.ui.setSpeaking(false);
        SF.ui.dropEmptyBubble && SF.ui.dropEmptyBubble();   // 被打断时还没出字的气泡不留着
        clearTimeout(idleTimer);
        SF.journey.hold(false);
    }

    // ================= 玩家输入 =================
    SF.journey.onPlayerInput = function (playerText) {
        if (!playerText || !currentTheme) return;

        interrupt();   // 朋友们正说着话，你插嘴了：立刻停下来听你说

        var userMsg = { role: 'michelle', text: playerText, speaker: (SF.voice && SF.voice.playerName()) || '玩家' };
        history.push(userMsg);
        SF.ui.renderDialogue({ role: 'michelle', text: playerText });
        scrollBottom();

        requestTurn(playerText);
    };

    /** 你开口时：让大家暂停（耳机模式 / 按住说话）；说完没内容会自动恢复 */
    SF.journey.hold = function (on) {
        clearTimeout(heldTimer);
        held = !!on;
        if (!SF.voice) return;
        if (on) {
            SF.voice.pauseAudio();
            heldTimer = setTimeout(function () { SF.journey.hold(false); }, 10000);   // 兜底
        } else {
            SF.voice.resumeAudio();
        }
    };

    // ================= 启动入口 =================
    SF.journey.startWithTheme = function (themeId) {
        if (!SF.journeyThemes || !SF.journeyThemes[themeId]) {
            alert('Theme not found: ' + themeId);
            return;
        }

        interrupt();
        currentTheme = SF.journeyThemes[themeId];
        history = [];

        if (isCustomTheme()) resetCustomMapping();

        // opening：system 描述；播完后让朋友们先开口，旅程自己动起来
        if (currentTheme.opening) {
            var text = String(currentTheme.opening).trim().replace(/^【|】$/g, '');
            var openMsg = { role: 'system', text: text };
            history.push(openMsg);
            SF.ui.renderDialogue(openMsg);
            scrollBottom();
        }
        requestTurn(null);
    };

    SF.journey._parseLine = function (l) { return parseLine(l); };   // 仅供测试

    SF.journey.isActive = function () { return !!currentTheme; };

    /** 离开旅程（回首页）时调用 */
    SF.journey.stop = function () {
        interrupt();
        currentTheme = null;
        if (SF.listen) SF.listen.stop();
    };

})(StoryForge);
