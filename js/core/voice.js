(function (SF) {

    /**
     * 角色语音：文字 → /api/voice/tts（edge-tts，每个角色固定声音）→ 播放。
     * 播放队列由 journey_engine 驱动；这里只负责取音频、播放、设置。
     */
    var V = SF.voice = SF.voice || {};

    var KEY = 'sf_settings';
    var settings = { voice: true, narration: false, speed: 1.0, listen: true, headphones: false, name: '', voices: {} };
    try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}

    function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) {} }

    V.get = function (k) { return settings[k]; };
    V.set = function (k, v) { settings[k] = v; save(); if (k === 'voice' && !v) V.stop(); };

    // 服务端没装 edge-tts 等情况下自动静音，不影响文字
    var available = true;

    V.shouldSpeak = function (role) {
        if (!settings.voice || !available) return false;
        if (role === 'michelle') return false;        // 玩家自己的话不念
        if (role === 'system') return settings.narration;
        return true;
    };

    var cache = {};   // key -> Promise<objectURL|null>

    /** 预取音频；返回 Promise<url|null>（失败给 null，退回纯文字） */
    V.fetch = function (text, role) {
        var r = role === 'system' ? 'narrator' : role;
        var vid = (settings.voices || {})[r] || '';
        var key = r + '|' + vid + '|' + text;
        if (cache[key]) return cache[key];
        var p = fetch('/api/voice/tts?role=' + encodeURIComponent(r) + (vid ? '&voice=' + encodeURIComponent(vid) : '') + '&text=' + encodeURIComponent(text))
            .then(function (res) {
                if (res.status === 503) available = false;
                if (!res.ok) throw new Error('tts ' + res.status);
                return res.blob();
            })
            .then(function (b) { return URL.createObjectURL(b); })
            .catch(function () { delete cache[key]; return null; });
        cache[key] = p;
        return p;
    };

    var audio = new Audio();
    audio.preload = 'auto';
    var curDone = null;
    var ducked = false, duckTimer = null;
    var playing = false;

    V.isPlaying = function () { return playing; };

    // iOS Safari：音频元素必须先在「用户手势」里播放一次才能解锁，之后 AI 回复到达时才能自动出声。
    var SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    var unlocked = false;
    V.unlock = function () {
        if (unlocked) return;
        unlocked = true;
        try {
            audio.src = SILENT;
            var p = audio.play();
            if (p && p.catch) p.catch(function () { unlocked = false; });
        } catch (e) { unlocked = false; }
        if (SF.listen && SF.listen.prime) SF.listen.prime();   // 同时在手势里准备好麦克风用的 AudioContext
    };
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (ev) {
        document.addEventListener(ev, V.unlock, { capture: true, passive: true });
    });

    // iOS 上 audio.volume 是只读的：不能「渐隐」，改用暂停
    V.canDuck = function () {
        try { audio.volume = 0.5; var ok = Math.abs(audio.volume - 0.5) < 0.01; audio.volume = 1; return ok; } catch (e) { return false; }
    };

    /** 你开口时先把角色音量渐隐（不硬停）；确认是你在说才真正打断，否则恢复 */
    V.duck = function (on) {
        ducked = !!on;
        clearTimeout(duckTimer);
        audio.volume = ducked ? 0.18 : 1;
        if (ducked) duckTimer = setTimeout(function () { V.duck(false); }, 8000);   // 兜底：别一直小声
    };

    // ---- 回声比对：角色刚说过的台词 ----
    var spoken = [];   // {t, text}
    function norm(t) { return String(t).replace(/[\s，。！？、…~,.!?;；:：“”"'「」（）()\-—]/g, ''); }
    function bigrams(s) {
        var m = {}, n = 0;
        for (var i = 0; i < s.length - 1; i++) { var g = s.substr(i, 2); m[g] = (m[g] || 0) + 1; n++; }
        return { m: m, n: n };
    }
    function dice(a, b) {
        if (a.length < 2 || b.length < 2) return 0;
        var A = bigrams(a), B = bigrams(b), inter = 0;
        for (var g in A.m) if (B.m[g]) inter += Math.min(A.m[g], B.m[g]);
        return 2 * inter / (A.n + B.n);
    }
    V.noteSpoken = function (text) {
        spoken.push({ t: Date.now(), text: norm(text) });
        if (spoken.length > 8) spoken.shift();
    };
    V.isEcho = function (text) {
        var x = norm(text);
        if (x.length < 2) return false;
        var now = Date.now();
        var recent = spoken.filter(function (e) { return now - e.t < 30000; });
        if (!recent.length) return false;
        var best = 0;
        for (var i = 0; i < recent.length; i++) {
            best = Math.max(best, dice(x, recent[i].text));
            if (i + 1 < recent.length) best = Math.max(best, dice(x, recent[i].text + recent[i + 1].text));
        }
        var all = recent.map(function (e) { return e.text; }).join('');
        if (x.length >= 4 && all.indexOf(x) >= 0) return true;
        return best >= 0.55;
    };

    /**
     * 播放一段音频。onStart(durationSec) 在真正开始播放时回调；
     * 返回 Promise，播放结束/被打断/失败都会 resolve。
     */
    V.play = function (url, onStart) {
        return new Promise(function (resolve) {
            var settled = false;
            function done() {
                if (settled) return;
                settled = true;
                curDone = null;
                playing = false;
                audio.onended = audio.onerror = audio.onplaying = null;
                resolve();
            }
            curDone = done;
            audio.onended = done;
            audio.onerror = done;
            audio.onplaying = function () {
                onStart && onStart(isFinite(audio.duration) ? audio.duration / audio.playbackRate : 0);
                audio.onplaying = null;
            };
            audio.src = url;
            audio.volume = ducked ? 0.18 : 1;
            playing = true;
            audio.playbackRate = settings.speed || 1;
            var pr = audio.play();
            if (pr && pr.catch) pr.catch(done);   // 浏览器拦截自动播放时直接退回纯文字
        });
    };

    V.stop = function () {
        try { audio.pause(); } catch (e) {}
        ducked = false; audio.volume = 1;
        if (curDone) curDone();
    };

    V.pauseAudio = function () { try { audio.pause(); } catch (e) {} };
    V.resumeAudio = function () { if (playing) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); } };

    /** 选择某个角色的声音；id 为空 = 用默认 */
    V.setRoleVoice = function (role, id) {
        var m = Object.assign({}, settings.voices || {});
        if (id) m[role] = id; else delete m[role];
        V.set('voices', m);
    };
    V.voices = function (cb) {
        fetch('/api/voice/voices').then(function (r) { return r.json(); }).then(function (d) { cb(d.voices || []); }).catch(function () { cb([]); });
    };
    V.playerName = function () { return (settings.name || '').trim(); };

    V.roles = function (cb) {
        fetch('/api/voice/roles').then(function (r) { return r.json(); }).then(cb).catch(function () { cb(null); });
    };

    V.preview = function (role, text) {
        V.stop();
        return V.fetch(text, role).then(function (u) { if (u) return V.play(u); });
    };

})(StoryForge);
