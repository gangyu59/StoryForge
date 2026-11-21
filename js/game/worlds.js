(function (SF) {

    /** 我的世界：自建场景保存在本机服务（data/worlds.json），下次直接进入，不用重新生成。 */
    SF.worlds = {};

    SF.worlds.list = function (cb) {
        fetch('/api/worlds').then(function (r) { return r.json(); })
            .then(function (d) {
                var out = [];
                (d.worlds || []).forEach(function (w) {
                    var t = SF.journeyCustomBuilder && SF.journeyCustomBuilder.fromSpec(w);
                    if (!t) return;
                    SF.journeyThemes = SF.journeyThemes || {};
                    SF.journeyThemes[t.id] = t;          // 注册后就能像内置主题一样启动
                    out.push(t);
                });
                cb(out);
            })
            .catch(function () { cb([]); });
    };

    SF.worlds.save = function (theme) {
        return fetch('/api/worlds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: theme.id, title: theme.title, desc: theme.desc || '', spec: theme.spec })
        }).then(function (r) { return r.ok; }).catch(function () { return false; });
    };

    SF.worlds.remove = function (id, cb) {
        fetch('/api/worlds/' + encodeURIComponent(id), { method: 'DELETE' })
            .then(function () { if (SF.journeyThemes) delete SF.journeyThemes[id]; cb && cb(true); })
            .catch(function () { cb && cb(false); });
    };

})(StoryForge);
