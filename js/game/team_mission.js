(function (SF) {

    SF.game = SF.game || {};
    SF.game.teamMission = SF.game.teamMission || {};

    var M = SF.game.teamMission;

    // ===== 固定结算映射（基础值：可预测）=====
    var BASE_EFFECTS = {
        Analyst:   { progress: +10, heat: +5,  intel: +1, morale:  0, time: -1 },
        Operator:  { progress: +20, heat: +15, intel:  0, morale: -1, time: -1 },
        Diplomat:  { progress:  +5, heat:  0, intel: +1, morale: +1, time: -1 }
    };

    function clamp(n, min, max) {
        n = Number(n);
        if (isNaN(n)) return min;
        return Math.max(min, Math.min(max, n));
    }

    function normalizeAgentName(name) {
        name = (name || '').toLowerCase();
        if (name.indexOf('analyst') >= 0 || name.indexOf('分析') >= 0) return 'Analyst';
        if (name.indexOf('operator') >= 0 || name.indexOf('执行') >= 0) return 'Operator';
        if (name.indexOf('diplomat') >= 0 || name.indexOf('谈判') >= 0) return 'Diplomat';
        return 'Analyst';
    }

    function safeJSONExtract(text) {
        if (!text) return null;
        try { return JSON.parse(text); } catch (e) {}

        var start = text.indexOf('{');
        var end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            var sliced = text.slice(start, end + 1);
            try { return JSON.parse(sliced); } catch (e2) {}
        }
        return null;
    }

    // ====== “可解释智能”核心：基于当前状态的确定性加成/惩罚 ======
    // 目的：结果不是“凭空来的”，而是你能理解：intel/morale/heat 会影响行动效果
    function computeSynergy(agent, state) {
        // 返回额外增量 + 原因说明
        var s = {
            progress: 0, heat: 0, intel: 0, morale: 0, time: 0,
            reasons: []
        };

        if (agent === 'Analyst') {
            // 情报越多，分析越快越准 -> 进度加成
            var bonus = clamp(state.intel * 2, 0, 10); // 0..10
            if (bonus > 0) {
                s.progress += bonus;
                s.reasons.push('你已有情报（intel）支撑推理，分析方案更高效：progress +' + bonus);
            } else {
                s.reasons.push('缺少情报（intel=0），分析只能先做基础排查：无额外加成');
            }

            // 热度太高时，分析动作更容易被察觉（轻微惩罚）
            if (state.heat >= 60) {
                s.heat += 3;
                s.reasons.push('当前暴露风险较高（heat≥60），任何技术操作都更容易留下痕迹：heat +3');
            }
        }

        if (agent === 'Operator') {
            // 士气越高，执行越果断 -> 进度加成
            var m = state.morale;
            var bonus2 = 0;
            if (m >= 4) bonus2 = 10;
            else if (m === 3) bonus2 = 5;
            else bonus2 = 0;

            if (bonus2 > 0) {
                s.progress += bonus2;
                s.reasons.push('团队士气（morale）良好，执行更果断：progress +' + bonus2);
            } else {
                s.reasons.push('团队士气偏低（morale≤2），执行效率受限：无额外加成');
            }

            // 情报为 0 时强行执行更容易踩坑（惩罚）
            if (state.intel === 0) {
                s.heat += 5;
                s.reasons.push('在缺乏情报（intel=0）的情况下强行执行，容易触发陷阱：heat +5');
            }
        }

        if (agent === 'Diplomat') {
            // 士气越高，谈判越稳，推进更快（进度加成）
            var bonus3 = clamp(state.morale * 2, 0, 10);
            if (bonus3 > 0) {
                s.progress += bonus3;
                s.reasons.push('团队状态稳定（morale）让你更有底气谈判：progress +' + bonus3);
            }
            // 热度高时谈判更难（轻惩罚：多耗一点时间）
            if (state.heat >= 70) {
                s.time -= 1; // 再耗 1 回合
                s.reasons.push('当前风声太紧（heat≥70），谈判拉扯更久：time -1');
            }
        }

        return s;
    }

    function addEffects(a, b) {
        return {
            progress: (a.progress || 0) + (b.progress || 0),
            heat: (a.heat || 0) + (b.heat || 0),
            intel: (a.intel || 0) + (b.intel || 0),
            morale: (a.morale || 0) + (b.morale || 0),
            time: (a.time || 0) + (b.time || 0)
        };
    }

    function applyEffects(state, eff) {
        state.progress = clamp(state.progress + (eff.progress || 0), 0, 100);
        state.heat = clamp(state.heat + (eff.heat || 0), 0, 100);
        state.intel = clamp(state.intel + (eff.intel || 0), 0, 5);
        state.morale = clamp(state.morale + (eff.morale || 0), 0, 5);
        state.timeLeft = state.timeLeft + (eff.time || 0);
    }

    function defaultTurnPack(state) {
        return {
            allies: [
                { agent: "Analyst", plan_id: "A1", action: "复原残留日志时间戳，锁定真实入口", rationale: "先拿确定性，减少弯路" },
                { agent: "Operator", plan_id: "O1", action: "快速潜入关键点位，抢先取回证据", rationale: "用速度换优势，拖延会更危险" },
                { agent: "Diplomat", plan_id: "D1", action: "联系内部人，以话术换临时通行与支援", rationale: "降低成本，减少暴露" }
            ],
            adversary: {
                disruption: "出现匿名误导线索，试图让你们跑错方向。",
                impact: { heat: +5, time: 0, morale: 0 },
                counterplay_hint: "对照线索时间戳：它与现场规律不一致"
            },
            narration: "你们争分夺秒。每次选择都会改变局势。",
            hook: "匿名线索背后，像是有人在盯你。"
        };
    }

    function buildPrompt(state) {
        // 给 AI 更具体的“你是谁/你偏好什么/你最讨厌什么”
        var prefs = (SF.profile && SF.profile.getSummary) ? SF.profile.getSummary() : '';
        var last = (state.lastResolve && state.lastResolve.short) ? state.lastResolve.short : '';

        return [
            "你是任务型团队博弈游戏的导演AI。你必须输出严格 JSON（不得添加任何多余文本）。",
            "目标：给出3名队友各1个具体方案 + 1个敌方干扰（含反制线索）+ 简短叙述与钩子。",
            "禁止：继续观察/继续探索/一切照旧/无进展。",
            "",
            "输出 JSON schema：",
            "{",
            '  "allies": [',
            '    {"agent":"Analyst","plan_id":"A?","action":"具体动作","rationale":"一句理由"},',
            '    {"agent":"Operator","plan_id":"O?","action":"具体动作","rationale":"一句理由"},',
            '    {"agent":"Diplomat","plan_id":"D?","action":"具体动作","rationale":"一句理由"}',
            '  ],',
            '  "adversary": {"disruption":"具体干扰","impact":{"heat":0,"time":0,"morale":0},"counterplay_hint":"一句反制线索"},',
            '  "narration":"<=120字",',
            '  "hook":"<=30字"',
            "}",
            "",
            "限制：impact 只允许小幅负面：heat 0..+10, time 0..-1, morale 0..-1。",
            "",
            "当前状态：",
            "- progress: " + state.progress,
            "- heat: " + state.heat,
            "- intel: " + state.intel,
            "- morale: " + state.morale,
            "- timeLeft: " + state.timeLeft,
            "- turn: " + state.turn,
            "",
            "玩家偏好摘要（如有）：" + (prefs || "未知"),
            "上回合结算摘要（如有）：" + (last || "无")
        ].join("\n");
    }

    function getInitState() {
        return {
            turn: 1,
            timeLeft: 8,
            progress: 0,
            heat: 10,
            intel: 0,
            morale: 3,
            abilities: [], // {id,label,desc,used:false}
            lastResolve: null
        };
    }

    function saveState(state) {
        SF.game = SF.game || {};
        SF.game.teamMissionState = state;
        if (SF.session && SF.session.save) SF.session.save();
    }

    function loadState() {
        if (SF.game && SF.game.teamMissionState) return SF.game.teamMissionState;
        return null;
    }

    function grantAbility(state) {
        var pool = [
            { id: 'ask_once', label: '追问一次', desc: '立刻获得 +1 情报（intel），用于提升分析/谈判效果（一次）。' },
            { id: 'cool_down', label: '快速撤离', desc: '立刻降低风险 heat -10（一次）。' },
            { id: 'push_once', label: '并行推进', desc: '立刻 +10 进度，同时 heat +5（一次）。' }
        ];

        var owned = {};
        state.abilities.forEach(function (a) { owned[a.id] = true; });

        for (var i = 0; i < pool.length; i++) {
            if (!owned[pool[i].id]) {
                var card = { id: pool[i].id, label: pool[i].label, desc: pool[i].desc, used: false };
                state.abilities.push(card);
                return card;
            }
        }
        return null;
    }

    function applyAbility(state, abilityId) {
        var a = null;
        for (var i = 0; i < state.abilities.length; i++) {
            if (state.abilities[i].id === abilityId) { a = state.abilities[i]; break; }
        }
        if (!a || a.used) return { ok: false };

        var eff = { progress: 0, heat: 0, intel: 0, morale: 0, time: 0 };
        var reason = '';

        if (abilityId === 'ask_once') {
            eff.intel = +1;
            reason = '使用能力「追问一次」：intel +1（为下回合推理/谈判提供支撑）';
        } else if (abilityId === 'cool_down') {
            eff.heat = -10;
            reason = '使用能力「快速撤离」：heat -10（降低暴露风险）';
        } else if (abilityId === 'push_once') {
            eff.progress = +10;
            eff.heat = +5;
            reason = '使用能力「并行推进」：progress +10，但 heat +5（用风险换进度）';
        } else {
            return { ok: false };
        }

        a.used = true;
        applyEffects(state, eff);
        return { ok: true, eff: eff, reason: reason };
    }

    function checkEnd(state) {
        if (state.progress >= 100 && state.timeLeft > 0) return { end: true, win: true };
        if (state.heat >= 100) return { end: true, win: false, reason: '暴露风险爆表（heat≥100），行动被迫终止。' };
        if (state.timeLeft <= 0 && state.progress < 100) return { end: true, win: false, reason: '窗口期关闭（time=0），任务未完成。' };
        if (state.morale <= 0) return { end: true, win: false, reason: '士气崩溃（morale=0），团队无法继续。' };
        return { end: false };
    }

    // ===== AI Turn Pack =====
    function generateTurnPack(state, done) {
        if (!SF.llm || !SF.llm.call) {
            done(defaultTurnPack(state), false);
            return;
        }

        if (SF.ui && SF.ui.showInlineThinking) SF.ui.showInlineThinking(true);

        SF.llm.call(
            buildPrompt(state),
            function (text) {
                if (SF.ui && SF.ui.showInlineThinking) SF.ui.showInlineThinking(false);

                var obj = safeJSONExtract(text);
                if (!obj || !obj.allies || !obj.adversary) {
                    done(defaultTurnPack(state), false);
                    return;
                }

                // 规范化 allies，确保三角色齐全
                var base = defaultTurnPack(state).allies;
                var allies = obj.allies || [];
                while (allies.length < 3) allies.push(base[allies.length]);

                allies = [
                    allies.find(function (x) { return normalizeAgentName(x.agent) === 'Analyst'; }) || base[0],
                    allies.find(function (x) { return normalizeAgentName(x.agent) === 'Operator'; }) || base[1],
                    allies.find(function (x) { return normalizeAgentName(x.agent) === 'Diplomat'; }) || base[2]
                ];
                obj.allies = allies;

                // 约束 adversary impact
                obj.adversary = obj.adversary || defaultTurnPack(state).adversary;
                obj.adversary.impact = obj.adversary.impact || {};
                obj.adversary.impact.heat = clamp(obj.adversary.impact.heat, 0, 10);
                obj.adversary.impact.time = clamp(obj.adversary.impact.time, -1, 0);
                obj.adversary.impact.morale = clamp(obj.adversary.impact.morale, -1, 0);

                obj.narration = String(obj.narration || '').slice(0, 120) || defaultTurnPack(state).narration;
                obj.hook = String(obj.hook || '').slice(0, 30) || defaultTurnPack(state).hook;

                done(obj, true);
            },
            function () {
                if (SF.ui && SF.ui.showInlineThinking) SF.ui.showInlineThinking(false);
                done(defaultTurnPack(state), false);
            }
        );
    }

    // ===== 公开 API =====
    M.startNew = function () {
        var state = getInitState();
        saveState(state);
        M.nextTurn();
    };

    M.resume = function () {
        var state = loadState();
        if (!state) { M.startNew(); return; }
        M.nextTurn(true);
    };

    M.nextTurn = function () {
        var state = loadState() || getInitState();

        var endInfo = checkEnd(state);
        if (endInfo.end) {
            SF.ui.teamMission.renderEnd(state, endInfo);
            return;
        }

        generateTurnPack(state, function (pack, usedAI) {
            saveState(state);
            SF.ui.teamMission.renderTurn(state, pack, usedAI, buildExpectedOutcomes(state));
        });
    };

    // 让玩家在点击前就看到“预计后果”（可预测）
    function buildExpectedOutcomes(state) {
        function expected(agent) {
            agent = normalizeAgentName(agent);
            var base = BASE_EFFECTS[agent] || BASE_EFFECTS.Analyst;
            var syn = computeSynergy(agent, state);
            var total = addEffects(base, syn);
            return {
                agent: agent,
                base: base,
                synergy: { eff: syn, reasons: syn.reasons },
                total: total
            };
        }
        return {
            Analyst: expected('Analyst'),
            Operator: expected('Operator'),
            Diplomat: expected('Diplomat')
        };
    }

    // 选择方案：产出“结算拆解”（可解释）
    M.choosePlan = function (agentName, pack) {
        var state = loadState() || getInitState();
        var prev = JSON.parse(JSON.stringify(state)); // 简单快照

        var agent = normalizeAgentName(agentName);

        // 1) 玩家方案 effect（基础 + synergy）
        var base = BASE_EFFECTS[agent] || BASE_EFFECTS.Analyst;
        var syn = computeSynergy(agent, state);
        var planEff = addEffects(base, syn);

        // 2) 敌人 effect（受限）
        var adv = (pack && pack.adversary) ? pack.adversary : defaultTurnPack(state).adversary;
        var impact = (adv && adv.impact) ? adv.impact : {};
        var enemyEff = {
            progress: 0,
            heat: clamp(impact.heat, 0, 10),
            intel: 0,
            morale: clamp(impact.morale, -1, 0),
            time: clamp(impact.time, -1, 0)
        };

        // 3) 应用结算（确定性）
        applyEffects(state, planEff);
        applyEffects(state, enemyEff);

        // 4) 每 2 回合奖励能力卡（可感知成长）
        var granted = null;
        if (state.turn % 2 === 0) {
            granted = grantAbility(state);
        }

        // 5) 生成回合摘要（用于下回合 prompt，使 AI 更“懂局势”）
        var short = '你执行了 ' + agent + '；进度' + prev.progress + '→' + state.progress +
            '，风险' + prev.heat + '→' + state.heat +
            '，情报' + prev.intel + '→' + state.intel +
            '，士气' + prev.morale + '→' + state.morale +
            '，剩余回合' + prev.timeLeft + '→' + state.timeLeft;

        state.lastResolve = {
            chosen: agent,
            short: short,
            adversary: {
                disruption: adv.disruption || '',
                hint: adv.counterplay_hint || ''
            }
        };

        // 6) 回合推进
        state.turn += 1;

        saveState(state);

        // 7) 传给 UI：完整因果拆解（你要的“为什么”）
        var breakdown = {
            chosenAgent: agent,
            plan: {
                base: base,
                synergy: { eff: syn, reasons: syn.reasons },
                total: planEff
            },
            enemy: {
                disruption: adv.disruption || '',
                hint: adv.counterplay_hint || '',
                eff: enemyEff
            },
            before: prev,
            after: state,
            explanation: {
                rule: '结果 = 基础结算 + 状态加成/惩罚（intel/morale/heat） + 敌人干扰（受限）',
                why: syn.reasons
            }
        };

        SF.ui.teamMission.renderResolve(state, pack, granted, breakdown);
    };

    // 能力使用：也必须可解释（返回原因与增量）
    M.useAbility = function (abilityId) {
        var state = loadState() || getInitState();
        var prev = JSON.parse(JSON.stringify(state));

        var r = applyAbility(state, abilityId);
        saveState(state);

        return {
            ok: r.ok,
            reason: r.reason || '',
            before: prev,
            after: state,
            eff: r.eff || null
        };
    };

    M.reset = function () {
        SF.game.teamMissionState = null;
        if (SF.session && SF.session.save) SF.session.save();
        M.startNew();
    };

})(StoryForge);