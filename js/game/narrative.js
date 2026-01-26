(function (SF) {

    SF.game = SF.game || {};

    SF.game.narrative = {
        opening: function () {
            return {
                id: 'scene_opening',
                title: '序章：低语的清晨',
                text: '你在陌生的清晨醒来。空气中有一丝不安的预兆，仿佛世界正等待你的第一个决定。',
                choices: [
                    { id: 'observe', label: '仔细观察周围环境' },
                    { id: 'act', label: '立刻采取行动' }
                ]
            };
        }
    };

})(StoryForge);