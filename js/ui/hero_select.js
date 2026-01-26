(function (SF) {

    SF.ui = SF.ui || {};

    /**
     * 渲染英雄路线选择界面（游戏第一屏）
     */
    SF.ui.renderHeroSelect = function () {
        var main = document.querySelector('.sf-main');
        if (!main) return;

        main.innerHTML = `
            <div class="sf-hero-select">
                <h2 class="sf-hero-title">你想成为什么样的英雄？</h2>
                <p class="sf-hero-subtitle">
                    世界正在发生一些无法解决的事情。<br>
                    你将被派去完成<strong>被认为不可能完成的任务</strong>。
                </p>

                <div class="sf-hero-cards">
                    ${heroCard(
                        'guardian',
                        '🛡️ 守护者',
                        '当他人陷入绝境，你选择站出来。',
                        [
                            '营救被困者',
                            '在混乱中守住底线',
                            '为他人承担代价'
                        ]
                    )}

                    ${heroCard(
                        'strategist',
                        '🧠 策士',
                        '别人觉得无解的局面，你能想出办法。',
                        [
                            '破解复杂困局',
                            '在不确定中找出最优解',
                            '用头脑阻止灾难'
                        ]
                    )}

                    ${heroCard(
                        'operator',
                        '⚡ 行动派',
                        '当时间所剩无几，你选择立刻行动。',
                        [
                            '高速决策',
                            '高风险高回报',
                            '在临界点改变结果'
                        ]
                    )}
                </div>
            </div>
        `;

        bindHeroSelectEvents();
    };

    function heroCard(id, title, desc, bullets) {
        return `
            <div class="sf-hero-card" data-hero="${id}">
                <h3>${title}</h3>
                <p class="sf-hero-desc">${desc}</p>
                <ul>
                    ${bullets.map(function (b) {
                        return `<li>${b}</li>`;
                    }).join('')}
                </ul>
                <button class="sf-hero-btn">选择这条路线</button>
            </div>
        `;
    }

    function bindHeroSelectEvents() {
        var cards = document.querySelectorAll('.sf-hero-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].addEventListener('click', function () {
                var hero = this.getAttribute('data-hero');
                selectHeroPath(hero);
            });
        }
    }

    function selectHeroPath(hero) {
        SF.game = SF.game || {};
        SF.game.heroPath = hero;

        // 记录为长期记忆（路线承诺）
        if (SF.memory && SF.memory.add) {
            SF.memory.add('longTerm', {
                type: 'hero_path_selected',
                hero: hero,
                at: Date.now()
            });
        }

        // 进入第一项任务
        if (SF.game.startFirstMission) {
            SF.game.startFirstMission(hero);
        }
    }

})(StoryForge);