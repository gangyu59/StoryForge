(function (SF) {

    SF.ui = SF.ui || {};
    SF.ui.teamMission = SF.ui.teamMission || {};

    /* =====================================================
     * 工具
     * ===================================================== */
    function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function fmt(v) {
        if (!v || v === 0) return '0';
        return (v > 0 ? '+' : '') + v;
    }

    /* =====================================================
     * 顶部状态：Thinking / Ready（不遮挡主界面）
     * ===================================================== */
    SF.ui.showInlineThinking = function (on) {
        var status = document.getElementById('sf-status');
        if (!status) return;

        if (on) {
            status.textContent = 'Thinking';
            status.classList.add('thinking');
        } else {
            status.textContent = 'Ready';
            status.classList.remove('thinking');
        }
    };

    /* =====================================================
     * HUD
     * ===================================================== */
    function renderHUD(state) {
        return `
            <div class="sf-hud">
                <div class="sf-hud-row">
                    <div class="sf-meter">
                        <div class="sf-meter-label">任务进度</div>
                        <div class="sf-meter-bar">
                            <div class="sf-meter-fill" style="width:${state.progress}%"></div>
                        </div>
                        <div class="sf-meter-value">${state.progress}%</div>
                    </div>

                    <div class="sf-meter sf-meter-danger">
                        <div class="sf-meter-label">暴露风险</div>
                        <div class="sf-meter-bar">
                            <div class="sf-meter-fill" style="width:${state.heat}%"></div>
                        </div>
                        <div class="sf-meter-value">${state.heat}%</div>
                    </div>
                </div>

                <div class="sf-hud-pills">
                    <span class="sf-pill">情报 Intel: ${state.intel}/5</span>
                    <span class="sf-pill">士气 Morale: ${state.morale}/5</span>
                    <span class="sf-pill">剩余回合 Time: ${state.timeLeft}</span>
                    <span class="sf-pill">回合 Turn: ${state.turn}</span>
                </div>
            </div>
        `;
    }

    /* =====================================================
     * 能力卡
     * ===================================================== */
    function renderAbilities(state) {
        var cards = state.abilities || [];

        if (!cards.length) {
            return `
                <div class="sf-abilities">
                    <div class="sf-abilities-title">能力卡</div>
                    <div class="sf-abilities-empty">
                        每 2 回合解锁一次能力卡，用于改变规则。
                    </div>
                </div>
            `;
        }

        var html = cards.map(function (a) {
            return `
                <div class="sf-ability-card ${a.used ? 'used' : ''}">
                    <div class="sf-ability-name">${esc(a.label)}</div>
                    <div class="sf-ability-desc">${esc(a.desc)}</div>
                    ${
                        a.used
                        ? `<button class="sf-ability-btn" disabled>已使用</button>`
                        : `<button class="sf-ability-btn" data-ability="${esc(a.id)}">使用</button>`
                    }
                </div>
            `;
        }).join('');

        return `
            <div class="sf-abilities">
                <div class="sf-abilities-title">能力卡（改变规则）</div>
                <div class="sf-abilities-grid">${html}</div>
            </div>
        `;
    }

    function bindAbilityButtons() {
        var btns = document.querySelectorAll('.sf-ability-btn[data-ability]');
        btns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-ability');
                var r = SF.game.teamMission.useAbility(id);
                if (r && r.ok) {
                    SF.ui.teamMission.renderAbilityApplied(r);
                }
            });
        });
    }

    /* =====================================================
     * Intro
     * ===================================================== */
    SF.ui.teamMission.renderIntro = function () {
        var main = document.querySelector('.sf-main');
        if (!main) return;

        main.innerHTML = `
            <div class="sf-card sf-intro">
                <h3>团队任务 · 可解释决策测试</h3>
                <p class="sf-intro-text">
                    每回合你会收到三名队友的不同方案。<br/>
                    <b>点之前看到预计后果</b>，<b>点之后看到因果拆解</b>。<br/><br/>
                    目标：在时间耗尽前，把任务推进到 100%。
                </p>

                <div class="sf-intro-actions">
                    <button class="sf-primary-btn" id="sf-start-mission">开始任务</button>
                    <button class="sf-secondary-btn" id="sf-resume-mission">继续上次</button>
                </div>
            </div>
        `;

        document.getElementById('sf-start-mission')
            .addEventListener('click', function () {
                SF.game.teamMission.startNew();
            });

        document.getElementById('sf-resume-mission')
            .addEventListener('click', function () {
                SF.game.teamMission.resume();
            });
    };

    /* =====================================================
     * Turn View（选择前）
     * ===================================================== */
    SF.ui.teamMission.renderTurn = function (state, pack, usedAI, expected) {
        var main = document.querySelector('.sf-main');
        if (!main) return;

        var cards = pack.allies.map(function (a) {
            var e = expected[a.agent] || {};
            return `
                <div class="sf-agent-card">
                    <div class="sf-agent-head">
                        <div class="sf-agent-name">${esc(a.agent)}</div>
                        <div class="sf-agent-tag">${usedAI ? 'AI' : 'Fallback'}</div>
                    </div>

                    <div class="sf-agent-action">${esc(a.action)}</div>
                    <div class="sf-agent-rationale">${esc(a.rationale)}</div>

                    <div class="sf-expected">
                        <div class="sf-expected-title">预计后果</div>
                        <div class="sf-expected-grid">
                            <span>progress ${fmt(e.total && e.total.progress)}</span>
                            <span>heat ${fmt(e.total && e.total.heat)}</span>
                            <span>intel ${fmt(e.total && e.total.intel)}</span>
                            <span>morale ${fmt(e.total && e.total.morale)}</span>
                            <span>time ${fmt(e.total && e.total.time)}</span>
                        </div>
                    </div>

                    <button class="sf-primary-btn sf-plan-btn"
                            data-agent="${esc(a.agent)}">
                        执行该方案
                    </button>
                </div>
            `;
        }).join('');

        main.innerHTML = `
            ${renderHUD(state)}

            <div class="sf-card sf-narration">
                <div class="sf-narration-title">当前局势</div>
                <div class="sf-narration-text">${esc(pack.narration)}</div>
                <div class="sf-hook">${esc(pack.hook)}</div>
            </div>

            ${renderAbilities(state)}

            <div class="sf-card sf-adversary">
                <div class="sf-adversary-title">对抗者动向</div>
                <div class="sf-adversary-text">${esc(pack.adversary.disruption)}</div>
                <div class="sf-adversary-hint">
                    反制线索：${esc(pack.adversary.counterplay_hint)}
                </div>
            </div>

            <div class="sf-team-grid">${cards}</div>
        `;

        document.querySelectorAll('.sf-plan-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                SF.game.teamMission.choosePlan(
                    btn.getAttribute('data-agent'),
                    pack
                );
            });
        });

        bindAbilityButtons();
    };

    /* =====================================================
     * Resolve View（因果解释）
     * ===================================================== */
    SF.ui.teamMission.renderResolve = function (state, pack, granted, breakdown) {
        var main = document.querySelector('.sf-main');
        if (!main) return;

        main.innerHTML = `
            ${renderHUD(state)}

            <div class="sf-card sf-breakdown">
                <div class="sf-breakdown-title">为什么会得到这个结果</div>

                <div class="sf-breakdown-section">
                    <b>你选择了：</b>${esc(breakdown.chosenAgent)}
                </div>

                <div class="sf-breakdown-section">
                    <b>你的行动带来的变化：</b>
                    <div class="sf-breakdown-grid">
                        <span>progress ${fmt(breakdown.plan.total.progress)}</span>
                        <span>heat ${fmt(breakdown.plan.total.heat)}</span>
                        <span>intel ${fmt(breakdown.plan.total.intel)}</span>
                        <span>morale ${fmt(breakdown.plan.total.morale)}</span>
                        <span>time ${fmt(breakdown.plan.total.time)}</span>
                    </div>
                </div>

                <div class="sf-breakdown-section">
                    <b>敌方干扰：</b>${esc(breakdown.enemy.disruption)}
                </div>

                <div class="sf-breakdown-section">
                    <b>系统解释：</b>
                    <ul class="sf-why-list">
                        ${breakdown.explanation.why.map(function (x) {
                            return `<li>${esc(x)}</li>`;
                        }).join('')}
                    </ul>
                </div>
            </div>

            ${
                granted
                ? `<div class="sf-reward">
                        <div class="sf-reward-title">你解锁了新能力</div>
                        <div class="sf-reward-name">${esc(granted.label)}</div>
                        <div class="sf-reward-desc">${esc(granted.desc)}</div>
                   </div>`
                : ''
            }

            ${renderAbilities(state)}

            <div class="sf-footer-actions">
                <button class="sf-primary-btn" id="sf-next-turn">下一回合</button>
            </div>
        `;

        document.getElementById('sf-next-turn')
            .addEventListener('click', function () {
                SF.game.teamMission.nextTurn();
            });

        bindAbilityButtons();
    };

    /* =====================================================
     * Ability Applied
     * ===================================================== */
    SF.ui.teamMission.renderAbilityApplied = function (r) {
        var main = document.querySelector('.sf-main');
        if (!main) return;

        main.innerHTML = `
            ${renderHUD(r.after)}

            <div class="sf-card sf-resolve">
                <div class="sf-resolve-title">能力生效</div>
                <div>${esc(r.reason)}</div>
            </div>

            <div class="sf-footer-actions">
                <button class="sf-primary-btn" id="sf-back">返回任务</button>
            </div>
        `;

        document.getElementById('sf-back')
            .addEventListener('click', function () {
                SF.game.teamMission.nextTurn(true);
            });
    };

    /* =====================================================
     * End
     * ===================================================== */
    SF.ui.teamMission.renderEnd = function (state, endInfo) {
        var main = document.querySelector('.sf-main');
        if (!main) return;

        main.innerHTML = `
            ${renderHUD(state)}

            <div class="sf-card sf-end">
                <h3>${endInfo.win ? '任务完成' : '任务失败'}</h3>
                <p>${esc(endInfo.reason || '')}</p>
                <button class="sf-primary-btn" id="sf-restart">重新开始</button>
            </div>
        `;

        document.getElementById('sf-restart')
            .addEventListener('click', function () {
                SF.game.teamMission.reset();
            });
    };

})(StoryForge);