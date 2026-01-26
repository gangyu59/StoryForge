(function (window) {
    if (window.StoryForge) return;

    window.StoryForge = {
        log: function (msg) {
            console.log('[StoryForge]', msg);
        }
    };
})(window);