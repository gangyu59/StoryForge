(function (SF) {

    SF.game = SF.game || {};

    SF.game.mission = {
        chapter: 1,
        locked: false
    };

    SF.game.mission.startStrategistMission = function () {
        SF.game.mission.start();
    };

    SF.game.mission.start = function () {
        SF.game.mission.chapter = 1;
        SF.game.mission.locked = false;

        SF.ui.renderScene({
            title: '异常初现',
            text:
                '最近几天，你隐约察觉到生活中出现了一些微妙的不协调。\n\n' +
                '并不明显，但足够让你无法忽视。',
            choices: [
                { id: 'observe', label: '开始留意周围的异常' },
                { id: 'ignore', label: '继续正常生活' }
            ]
        });
    };

    SF.game.mission.next = function (choiceId) {

        if (SF.game.mission.locked) return;
        SF.game.mission.locked = true;

        SF.ui.showLoading();

        SF.ai.request(
            {
                role: 'world_change',
                chapter: SF.game.mission.chapter,
                choice: choiceId,
                instruction:
                    '你是一个剧情推进引擎。\n' +
                    '你必须制造【可感知的世界变化】。\n\n' +
                    '禁止出现：\n' +
                    '“一切如常 / 没有变化 / 生活照旧 / 没引起注意”。\n\n' +
                    '必须至少引入以下之一：\n' +
                    '- 一个新人物\n' +
                    '- 一个具体事件\n' +
                    '- 一个明确的威胁\n' +
                    '- 一个不可逆的线索\n\n' +
                    '输出结构：\n' +
                    '{ title, text, choices }'
            },

            function (aiResult) {
                SF.ui.hideLoading();
                SF.game.mission.locked = false;

                var text = (aiResult.text || '').toLowerCase();

                var isBoring =
                    text.includes('一切') ||
                    text.includes('没有') ||
                    text.includes('照旧') ||
                    text.includes('如常');

                // 🚨 核心：拒绝无变化剧情
                if (isBoring) {
                    forceWorldChange();
                    return;
                }

                SF.game.mission.chapter += 1;

                SF.ui.renderScene({
                    title: aiResult.title || '局势升级',
                    text: aiResult.text,
                    choices: aiResult.choices || [
                        { id: 'continue', label: '继续应对变化' }
                    ]
                });
            },

            function () {
                SF.ui.hideLoading();
                SF.game.mission.locked = false;
                forceWorldChange();
            }
        );
    };

    // ============================
    // 强制事件（兜底）
    // ============================
    function forceWorldChange() {

        SF.game.mission.chapter += 1;

        SF.ui.renderScene({
            title: '突发事件',
            text:
                '就在你以为一切还能维持现状时，一件突如其来的事件打破了平衡。\n\n' +
                '一条与你有关的记录，被上传到了你无法访问的系统中。\n' +
                '你不知道是谁做的，但你确定——\n\n' +
                '你已经被盯上了。',
            choices: [
                { id: 'trace', label: '试图追查记录来源' },
                { id: 'hide', label: '隐藏自己的行踪' }
            ]
        });
    }

})(StoryForge);