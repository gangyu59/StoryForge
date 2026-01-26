(function (SF) {

    SF.session = {};

    SF.session.save = function () {
        var data = {
            worldData: {
                meta: SF.world.meta,
                time: SF.world.time,
                player: SF.world.player,
                flags: SF.world.flags
            },
            memoryData: {
                shortTerm: SF.memory.shortTerm,
                midTerm: SF.memory.midTerm,
                longTerm: SF.memory.longTerm
            },
            milestoneData: {
                achieved: SF.milestones.achieved,
                active: SF.milestones.active
            }
        };

        localStorage.setItem('storyforge_session', JSON.stringify(data));
        SF.log('Session saved');
    };

    SF.session.load = function () {
        var raw = localStorage.getItem('storyforge_session');
        if (!raw) return false;

        var data = JSON.parse(raw);

        // ❗❗❗ 只“灌数据”，绝不替换对象
        if (data.worldData) {
            Object.assign(SF.world.meta, data.worldData.meta || {});
            Object.assign(SF.world.time, data.worldData.time || {});
            Object.assign(SF.world.player, data.worldData.player || {});
            Object.assign(SF.world.flags, data.worldData.flags || {});
        }

        if (data.memoryData) {
            SF.memory.shortTerm = data.memoryData.shortTerm || [];
            SF.memory.midTerm = data.memoryData.midTerm || [];
            SF.memory.longTerm = data.memoryData.longTerm || [];
        }

        if (data.milestoneData) {
            SF.milestones.achieved = data.milestoneData.achieved || [];
            SF.milestones.active = data.milestoneData.active || [];
        }

        SF.log('Session restored (world safe)');
        return true;
    };

})(StoryForge);