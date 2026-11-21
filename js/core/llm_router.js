(function (SF) {

    /**
     * LLM 统一入口：只走本机服务（/api/llm），由服务调用已登录的 Claude 订阅。
     * 不再需要任何 API Key。
     *
     *   SF.llm.call(prompt, ok, err, opts)   一次性拿完整文本（兼容旧代码）
     *   SF.llm.stream(prompt, handlers, opts) 流式：onLine(整行) / onDone() / onError(msg)，返回 abort()
     *   opts.model: 'fast'（默认，剧情对话）| 'smart'（生成世界 / 任务 JSON）
     */
    SF.llm = SF.llm || {};
    SF.llm.load = function () {};

    function errText(e) { return (e && e.message) ? e.message : String(e || '未知错误'); }

    SF.llm.call = function (prompt, ok, err, opts) {
        fetch('/api/llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt, model: (opts && opts.model) || '' })
        })
        .then(function (r) {
            return r.json().then(function (d) {
                if (!r.ok) throw new Error(d.detail || ('HTTP ' + r.status));
                return d;
            });
        })
        .then(function (d) { ok && ok(d.text || ''); })
        .catch(function (e) { err && err(errText(e)); });
    };

    SF.llm.stream = function (prompt, h, opts) {
        h = h || {};
        var ctrl = new AbortController();
        var buf = '';
        var finished = false;

        function flushLines(final) {
            var parts = buf.split('\n');
            buf = final ? '' : parts.pop();
            if (final) buf = '';
            parts.forEach(function (l) {
                l = l.trim();
                if (l) h.onLine && h.onLine(l);
            });
        }
        function finish(msg) {
            if (finished) return;
            finished = true;
            if (msg) h.onError && h.onError(msg);
            else {
                flushLines(true);
                h.onDone && h.onDone();
            }
        }

        fetch('/api/llm/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt, model: (opts && opts.model) || '' }),
            signal: ctrl.signal
        }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            var reader = r.body.getReader();
            var dec = new TextDecoder();
            var sse = '';

            function onEvent(ev) {
                if (ev.type === 'delta') { buf += ev.text; flushLines(false); }
                else if (ev.type === 'error') finish(ev.message || 'Claude 调用失败');
                else if (ev.type === 'done') finish();
            }
            function pump() {
                return reader.read().then(function (res) {
                    if (res.done) { finish(); return; }
                    sse += dec.decode(res.value, { stream: true });
                    var chunks = sse.split('\n\n');
                    sse = chunks.pop();
                    chunks.forEach(function (c) {
                        if (c.indexOf('data: ') !== 0) return;
                        try { onEvent(JSON.parse(c.slice(6))); } catch (e) {}
                    });
                    return finished ? null : pump();
                });
            }
            return pump();
        }).catch(function (e) {
            if (e && e.name === 'AbortError') { finished = true; return; }
            finish(errText(e));
        });

        return function abort() { finished = true; try { ctrl.abort(); } catch (e) {} };
    };

    /** 从模型输出里取 JSON（容忍代码块围栏和前后多余文字） */
    SF.llm.extractJSON = function (text) {
        if (!text) return null;
        var t = String(text).replace(/```(?:json)?/gi, '');
        var i = t.indexOf('{'), j = t.lastIndexOf('}');
        if (i < 0 || j <= i) return null;
        try { return JSON.parse(t.slice(i, j + 1)); } catch (e) { return null; }
    };

    /** 服务状态（首页提示用） */
    SF.llm.health = function (cb) {
        fetch('/api/health').then(function (r) { return r.json(); })
            .then(function (d) { cb(d); })
            .catch(function () { cb(null); });
    };

})(StoryForge);
