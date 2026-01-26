(function (SF) {

    SF.world = SF.world || {};

    // ===============================
    // 基础世界结构兜底（必须）
    // ===============================
    SF.world.flags = SF.world.flags || {};
    SF.world.player = SF.world.player || {};
    SF.world.time = SF.world.time || {};

    if (typeof SF.world.player.influence !== 'number') {
        SF.world.player.influence = 0;
    }

    // ===============================
    // Identity Phase System (A1)
    // ===============================
    // 0: 普通人
    // 1: 被观察者
    // 2: 不稳定变量
    // 3: 关键节点

    if (typeof SF.world.identityPhase !== 'number') {
        SF.world.identityPhase = 0;
    }

    SF.world.identityPhaseName = function () {
        switch (SF.world.identityPhase) {
            case 0: return '普通人';
            case 1: return '被观察者';
            case 2: return '不稳定变量';
            case 3: return '关键节点';
            default: return '未知';
        }
    };

    // 身份阶段推进（只增不减）
    SF.world.advanceIdentityPhase = function (reason) {
        if (SF.world.identityPhase >= 3) return false;

        SF.world.identityPhase += 1;

        // 长期记忆（如果存在 memory）
        if (SF.memory && SF.memory.add) {
            SF.memory.add('longTerm', {
                type: 'identity_phase_advance',
                phase: SF.world.identityPhase,
                name: SF.world.identityPhaseName(),
                reason: reason || 'unknown',
                at: Date.now()
            });
        }

        return true;
    };

})(StoryForge);