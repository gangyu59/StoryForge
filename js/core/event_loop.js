(function (SF) {

    if (!SF.world) {
        console.error('[StoryForge] World missing before event loop');
        return;
    }

    SF.world.tickIfNeeded = function () {
        var now = Date.now();
        var last = SF.world.time.lastActiveAt || now;
        var delta = now - last;

        // 少于 1 分钟不推进
        if (delta < 60 * 1000) {
            SF.world.time.lastActiveAt = now;
            return null;
        }

        var ticks = Math.floor(delta / (5 * 60 * 1000));
        if (ticks <= 0) {
            SF.world.time.lastActiveAt = now;
            return null;
        }

        SF.world.time.tick += ticks;
        SF.world.time.lastActiveAt = now;

        console.log('[StoryForge] World advanced by', ticks, 'ticks');

        return {
            ticks: ticks,
            minutes: Math.floor(delta / 60000)
        };
    };

    console.log('[StoryForge] World event loop ready');

})(StoryForge);