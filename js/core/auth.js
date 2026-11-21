(function () {

    /**
     * 访问口令（服务端设了 SF_ACCESS_CODE 才需要）：
     * 给所有 /api/* 请求自动带上口令；口令错了/没填，弹窗询问并记在本机，然后自动重试。
     * 通过 ngrok 等方式让手机访问时，务必设置口令，否则别人也能用你的 Claude 订阅。
     */
    var KEY = 'sf_code';
    var orig = window.fetch.bind(window);
    var asking = null;

    function isApi(u) { return typeof u === 'string' && u.indexOf('/api/') === 0; }

    function withCode(init) {
        init = Object.assign({}, init || {});
        var h = new Headers(init.headers || {});
        var c = localStorage.getItem(KEY);
        if (c) h.set('x-access-code', c);
        init.headers = h;
        return init;
    }

    function ask() {
        if (!asking) {
            asking = new Promise(function (resolve) {
                var c = window.prompt('这个服务需要访问口令：');
                if (c) { localStorage.setItem(KEY, c.trim()); resolve(true); } else resolve(false);
            }).then(function (ok) { asking = null; return ok; });
        }
        return asking;
    }

    window.fetch = function (input, init) {
        if (!isApi(input)) return orig(input, init);
        return orig(input, withCode(init)).then(function (r) {
            if (r.status !== 401) return r;
            return ask().then(function (ok) { return ok ? orig(input, withCode(init)) : r; });
        });
    };

})();
