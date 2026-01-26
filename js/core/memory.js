(function (SF) {

    if (!SF) {
        console.error('StoryForge namespace missing');
        return;
    }

    SF.memory = SF.memory || {
        shortTerm: [],
        midTerm: [],
        longTerm: []
    };

    SF.memory.add = function (layer, content) {
        if (!SF.memory[layer]) {
            console.error('Invalid memory layer:', layer);
            return;
        }

        SF.memory[layer].push({
            content: content,
            timestamp: Date.now()
        });
    };

    SF.memory.snapshot = function () {
        return {
            shortTerm: SF.memory.shortTerm.slice(-5),
            midTerm: SF.memory.midTerm.slice(-10),
            longTerm: SF.memory.longTerm
        };
    };

    SF.memory.clearShortTerm = function () {
        SF.memory.shortTerm = [];
    };

    console.log('[StoryForge] Memory system ready');

})(StoryForge);