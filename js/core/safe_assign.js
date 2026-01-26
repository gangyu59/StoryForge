(function () {

    var originalAssign = Object.assign;

    Object.assign = function (target) {
        // 如果 target 不存在，直接创建一个新对象
        if (target === null || target === undefined) {
            target = {};
        }

        for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            if (source === null || source === undefined) continue;

            for (var key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    target[key] = source[key];
                }
            }
        }

        return target;
    };

})();