(function (SF) {

    if (!SF) {
        console.error('StoryForge namespace missing');
        return;
    }

    SF.milestones = SF.milestones || {
        achieved: [],
        active: []
    };

    SF.milestones.trigger = function (milestone) {
        if (!milestone || !milestone.id) return;

        SF.milestones.achieved.push({
            id: milestone.id,
            title: milestone.title || '',
            impact: milestone.impact || '',
            time: Date.now()
        });

        // 进入长期记忆
        if (SF.memory && SF.memory.add) {
            SF.memory.add('longTerm', {
                type: 'milestone',
                title: milestone.title,
                impact: milestone.impact
            });
        }
    };

    console.log('[StoryForge] Milestone system ready');

})(StoryForge);