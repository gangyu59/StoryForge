(function (SF) {

    SF.game = SF.game || {};
    SF.game.choices = {};

    /**
     * ============================
     * 全局唯一 choice 入口
     * ============================
     */
    SF.game.choices.handle = function (choiceId) {

        // ============================
        // 🔴 强制：任务引擎优先
        // ============================
        if (
            SF.game.mission &&
            typeof SF.game.mission.next === 'function' &&
            SF.game.mission.chapter >= 1
        ) {
            SF.game.mission.next(choiceId);
            return;
        }

        // ============================
        // ⚠️ 旧逻辑兜底（未来可以删）
        // ============================
        if (SF.game.narrative && SF.game.narrative.next) {
            var scene = SF.game.narrative.next(choiceId);
            if (scene) {
                SF.ui.renderScene(scene);
            }
            return;
        }

        // ============================
        // ❌ 最低级兜底（防止死点击）
        // ============================
        SF.ui.renderScene({
            title: '无效操作',
            text:
                '你的行动没有引发任何变化。\n\n' +
                '这可能意味着当前阶段已经结束，或你需要重新开始任务。',
            choices: [
                { id: 'restart', label: '重新开始' }
            ]
        });
    };

})(StoryForge);