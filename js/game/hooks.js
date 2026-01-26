(function (SF) {

    SF.game = SF.game || {};

    SF.game.hooks = {
        current: null,

        set: function (hook) {
            SF.game.hooks.current = hook;
        },

        get: function () {
            return SF.game.hooks.current;
        }
    };

})(StoryForge);