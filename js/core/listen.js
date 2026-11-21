(function (SF) {

    /**
     * 常开聆听：不用按按钮，随时听你说话。
     *
     * 麦克风(带回声消除) → 能量 VAD 切句 → /api/voice/stt (本机 Whisper) → 回声比对 → 自动发送
     *
     * 如何分辨「角色在说」和「我在说」：
     *   1) 浏览器回声消除把喇叭声从麦克风里减掉大部分（耳机模式则根本没有回声）
     *   2) 角色正在说话时，开口要持续更久才算数，并先把角色音量「渐隐」而不是硬停
     *   3) Whisper 出字后，与角色刚说过的台词比对（SF.voice.isEcho），像回声的直接丢弃并恢复音量
     */
    var L = SF.listen = {};

    var FRAME_MS = 30;
    var PREROLL_FRAMES = 10;        // 开口前保留 300ms，避免吃掉第一个字
    var END_SILENCE_MS = 800;       // 停顿多久算说完
    var MIN_VOICED_MS = 300;        // 太短的声音当噪声
    var MAX_UTTER_MS = 25000;
    var CONFIRM_MS = 150;           // 安静时：持续多久算开口
    var CONFIRM_MS_PLAYING = 400;   // 角色在说话时：要更久，抗回声
    var MIN_THR = 0.012;

    var on = false;
    var ctx = null, stream = null, node = null, mute = null;
    var shared = null, workletReady = false, wakeLock = null;
    var inRate = 48000;

    var acc = [], accLen = 0, frameSamples = 0;
    var floor = 0.006;
    var mode = 'idle';              // idle | rec
    var preroll = [];
    var rec = [], recMs = 0, voicedMs = 0, silentMs = 0, hotMs = 0, hotBuf = [];
    var pending = 0;                // 正在识别的段数
    var listeners = [];
    var lastState = '';
    var lastError = '';             // 启动失败的原因（给界面提示用）

    function state() {
        if (!on) return lastError ? 'error' : 'off';
        if (pending > 0) return 'busy';
        if (mode === 'rec') return 'hearing';
        return 'listening';
    }
    function emit() {
        var s = state();
        if (s === lastState) return;
        lastState = s;
        document.body.classList.toggle('sf-listening', on);
        listeners.forEach(function (f) { try { f(s); } catch (e) {} });
    }
    L.onState = function (f) { listeners.push(f); f(state()); };
    L.isOn = function () { return on; };

    function toast(msg) {
        var t = document.createElement('div');
        t.className = 'sf-toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function () { t.classList.add('out'); }, 3200);
        setTimeout(function () { t.remove(); }, 3800);
    }

    var WORKLET = 'class P extends AudioWorkletProcessor{process(i){var c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true;}}registerProcessor("sf-cap",P);';

    /** 在用户手势里提前创建并唤醒 AudioContext（iOS 不在手势里创建的话会一直 suspended） */
    L.prime = function () {
        try {
            if (!shared) shared = new (window.AudioContext || window.webkitAudioContext)();
            if (shared.state === 'suspended') shared.resume();
        } catch (e) {}
    };

    function keepAwake() {
        try {
            if (navigator.wakeLock && !wakeLock) {
                navigator.wakeLock.request('screen').then(function (l) {
                    wakeLock = l;
                    l.addEventListener('release', function () { wakeLock = null; });
                }).catch(function () {});
            }
        } catch (e) {}
    }
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && on) keepAwake();   // 手机切回来后重新保持亮屏
    });

    L.start = async function () {
        if (on) return true;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            lastError = 'fail'; lastState = ''; emit();
            toast('当前浏览器不支持麦克风（需要 localhost 或 https）');
            return false;
        }
        lastError = '';
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
            });
            L.prime();
            ctx = shared;
            if (ctx.state === 'suspended') await ctx.resume();
            inRate = ctx.sampleRate;
            frameSamples = Math.round(inRate * FRAME_MS / 1000);

            if (!workletReady) {
                var url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
                await ctx.audioWorklet.addModule(url);
                workletReady = true;
            }
            node = new AudioWorkletNode(ctx, 'sf-cap');
            mute = ctx.createGain();
            mute.gain.value = 0;                         // 不把自己的声音放出来
            ctx.createMediaStreamSource(stream).connect(node);
            node.connect(mute); mute.connect(ctx.destination);
            node.port.onmessage = function (e) { feed(e.data); };
        } catch (e) {
            cleanup();
            lastError = (e && e.name === 'NotAllowedError') ? 'denied' : 'fail';
            toast(lastError === 'denied' ? '没有麦克风权限：请点地址栏左边的图标，允许麦克风后，再点右上角 🎙' : '麦克风启动失败：' + (e && e.message || e));
            lastState = '';
            emit();
            return false;
        }
        on = true;
        keepAwake();
        mode = 'idle'; preroll = []; rec = []; pending = 0; hotMs = 0; hotBuf = [];
        emit();
        return true;
    };

    function cleanup() {
        try { if (node) node.port.onmessage = null; } catch (e) {}
        try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        try { if (node) node.disconnect(); if (mute) mute.disconnect(); } catch (e) {}
        try { if (ctx) ctx.suspend(); } catch (e) {}          // 共享的 AudioContext 不关闭，只挂起（省电，下次直接恢复）
        try { if (wakeLock) wakeLock.release(); } catch (e) {}
        wakeLock = null;
        node = mute = ctx = stream = null;
        acc = []; accLen = 0;
    }

    L.stop = function () {
        lastError = '';
        if (!on && !ctx) { lastState = ''; emit(); return; }
        on = false;
        cleanup();
        mode = 'idle'; rec = []; preroll = []; hotMs = 0; hotBuf = [];
        if (SF.voice) SF.voice.duck(false);
        if (SF.journey && SF.journey.hold) SF.journey.hold(false);
        emit();
    };

    L.toggle = function () { return on ? (L.stop(), false) : L.start(); };

    // ---------- 采集 → 30ms 帧 ----------
    function feed(chunk) {
        acc.push(chunk); accLen += chunk.length;
        while (accLen >= frameSamples) {
            var frame = new Float32Array(frameSamples), n = 0;
            while (n < frameSamples) {
                var head = acc[0], need = frameSamples - n;
                if (head.length <= need) { frame.set(head, n); n += head.length; acc.shift(); }
                else { frame.set(head.subarray(0, need), n); acc[0] = head.subarray(need); n += need; }
            }
            accLen -= frameSamples;
            onFrame(frame);
        }
    }

    function rms(f) {
        var s = 0;
        for (var i = 0; i < f.length; i++) s += f[i] * f[i];
        return Math.sqrt(s / f.length);
    }

    function threshold() {
        var t = Math.max(MIN_THR, floor * 3.2);
        // 外放且角色在说话：残余回声会抬高音量，门槛放高
        if (SF.voice.isPlaying() && !SF.voice.get('headphones')) t *= 1.8;
        return t;
    }

    function onFrame(frame) {
        if (!on) return;
        var level = rms(frame);
        var thr = threshold();
        var hot = level > thr;
        var playing = SF.voice.isPlaying();
        var headphones = SF.voice.get('headphones');

        if (mode === 'idle') {
            if (!hot) floor = Math.max(0.003, floor * 0.96 + level * 0.04);   // 跟踪环境底噪
            preroll.push(frame);
            if (preroll.length > PREROLL_FRAMES) preroll.shift();

            if (hot) { hotMs += FRAME_MS; hotBuf.push(frame); }
            else if (hotMs > 0) { hotMs = Math.max(0, hotMs - FRAME_MS * 2); if (!hotMs) hotBuf = []; }

            var need = (playing && !headphones) ? CONFIRM_MS_PLAYING : CONFIRM_MS;
            if (hotMs >= need) {
                // 确认你开口了：开始录音；角色音量先渐隐（耳机模式直接暂停）
                mode = 'rec';
                rec = preroll.slice(); preroll = []; hotBuf = [];
                recMs = rec.length * FRAME_MS; voicedMs = hotMs; silentMs = 0; hotMs = 0;
                if (playing) {
                    if (headphones || !SF.voice.canDuck()) SF.journey.hold(true); else SF.voice.duck(true);
                }
                emit();
            }
            return;
        }

        // rec
        rec.push(frame); recMs += FRAME_MS;
        if (hot) { voicedMs += FRAME_MS; silentMs = 0; } else silentMs += FRAME_MS;
        if (silentMs >= END_SILENCE_MS || recMs >= MAX_UTTER_MS) finalize();
    }

    function finalize() {
        var frames = rec, voiced = voicedMs;
        mode = 'idle'; rec = []; silentMs = 0; voicedMs = 0; recMs = 0; hotMs = 0;
        if (voiced < MIN_VOICED_MS) { release(); emit(); return; }   // 只是噪声
        pending++;
        emit();
        sendSegment(frames).then(handleText, function () { return ''; }).then(function () {
            pending--; emit();
        });
    }

    function release() {
        SF.voice.duck(false);
        SF.journey.hold(false);
    }

    // ---------- 重采样 + 发给 Whisper ----------
    function toPCM16(frames) {
        var total = 0; frames.forEach(function (f) { total += f.length; });
        var all = new Float32Array(total), o = 0;
        frames.forEach(function (f) { all.set(f, o); o += f.length; });
        var ratio = inRate / 16000, outLen = Math.floor(all.length / ratio);
        var out = new Int16Array(outLen);
        for (var i = 0; i < outLen; i++) {
            var pos = i * ratio, i0 = Math.floor(pos), i1 = Math.min(i0 + 1, all.length - 1), fr = pos - i0;
            var v = all[i0] * (1 - fr) + all[i1] * fr;
            out[i] = Math.max(-1, Math.min(1, v)) * 32767;
        }
        return out;
    }

    function sendSegment(frames) {
        return fetch('/api/voice/stt', { method: 'POST', body: toPCM16(frames).buffer })
            .then(function (r) {
                if (r.status === 503) { toast('服务端没装语音识别（pip install mlx-whisper）'); L.stop(); return ''; }
                if (!r.ok) throw new Error('stt ' + r.status);
                return r.json();
            })
            .then(function (d) { return (d && d.text || '').trim(); });
    }

    function handleText(text) {
        if (!on || !text) { release(); return; }
        if (!SF.voice.get('headphones') && SF.voice.isEcho(text)) {
            try { console.debug('[SF][listen] 判定为回声，丢弃：', text); } catch (e) {}
            release();
            return;
        }
        // 真的是你说的：onPlayerInput 会打断角色并发出这句话
        SF.voice.duck(false);
        if (SF.journey && SF.journey.onPlayerInput) SF.journey.onPlayerInput(text);
    }

})(StoryForge);
