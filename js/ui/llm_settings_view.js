(function (SF) {

    SF.ui = SF.ui || {};

    var ROLES = [
        { id: 'sakura',   name: '林之樱' },
        { id: 'jerry',    name: '周行简' },
        { id: 'kevin',    name: '方野' },
        { id: 'narrator', name: '旁白' }
    ];
    var SAMPLE = {
        sakura: '哇，你们看，花瓣落在肩膀上了。',
        jerry: '先别急，我们按路线走，时间刚好。',
        kevin: '哎呀走啦走啦，边走边吃才是旅行嘛！',
        narrator: '微风拂过，一天才刚刚开始。'
    };

    function close() {
        var ov = document.getElementById('sf-settings-sheet');
        if (ov) ov.remove();
    }

    // 设置面板：浮层形式，不会打断正在进行的旅程。
    // （AI 已统一使用本机 Claude 订阅，不再需要任何 API Key。）
    SF.ui.showLLMSettings = function () {
        close();
        var ov = document.createElement('div');
        ov.id = 'sf-settings-sheet';
        ov.className = 'sf-sheet-mask';
        ov.innerHTML =
            '<div class="sf-sheet">' +
              '<div class="sf-sheet-head"><b>设置</b><button type="button" id="sf-sheet-close">完成</button></div>' +
              '<div class="sf-set-row"><span>你的名字 <em>朋友们会这样叫你</em></span><input type="text" id="sf-set-name" maxlength="12" placeholder="比如：小明"></div>' +
              '<div class="sf-set-row"><span>AI</span><em id="sf-set-ai">检查中…</em></div>' +
              '<label class="sf-set-row"><span>常开聆听 <em>不用按键，直接说话</em></span><input type="checkbox" id="sf-set-listen"></label>' +
              '<label class="sf-set-row"><span>我戴了耳机 <em>可随时插话，识别更准</em></span><input type="checkbox" id="sf-set-hp"></label>' +
              '<label class="sf-set-row"><span>角色语音</span><input type="checkbox" id="sf-set-voice"></label>' +
              '<label class="sf-set-row"><span>朗读旁白</span><input type="checkbox" id="sf-set-narr"></label>' +
              '<label class="sf-set-row"><span>语速 <em id="sf-set-speed-v"></em></span>' +
                '<input type="range" id="sf-set-speed" min="0.8" max="1.4" step="0.05"></label>' +
              '<div class="sf-set-row"><span>版本</span><em id="sf-set-build">-</em></div>' +
              '<div class="sf-set-title">角色声音 <em>（选一个就能试听；自定义世界按出场顺序对应前三位）</em></div>' +
              '<div id="sf-set-roles" class="sf-set-roles"></div>' +
            '</div>';
        document.body.appendChild(ov);

        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        ov.querySelector('#sf-sheet-close').onclick = close;

        var v = ov.querySelector('#sf-set-voice'), n = ov.querySelector('#sf-set-narr'),
            sp = ov.querySelector('#sf-set-speed'), spv = ov.querySelector('#sf-set-speed-v');
        var nm = ov.querySelector('#sf-set-name');
        nm.value = SF.voice.get('name') || '';
        nm.oninput = function () { SF.voice.set('name', nm.value.trim()); };
        var li = ov.querySelector('#sf-set-listen'), hp = ov.querySelector('#sf-set-hp');
        li.checked = !!SF.voice.get('listen');
        hp.checked = !!SF.voice.get('headphones');
        li.onchange = function () {
            SF.voice.set('listen', li.checked);
            if (li.checked) { if (SF.journey.isActive && SF.journey.isActive()) SF.listen.start(); }
            else SF.listen.stop();
        };
        hp.onchange = function () { SF.voice.set('headphones', hp.checked); };
        v.checked = !!SF.voice.get('voice');
        n.checked = !!SF.voice.get('narration');
        sp.value = SF.voice.get('speed') || 1;
        spv.textContent = (+sp.value).toFixed(2) + '×';
        v.onchange = function () { SF.voice.set('voice', v.checked); SF.ui.paintVoiceToggle && SF.ui.paintVoiceToggle(); };
        n.onchange = function () { SF.voice.set('narration', n.checked); };
        sp.oninput = function () { SF.voice.set('speed', +sp.value); spv.textContent = (+sp.value).toFixed(2) + '×'; };

        SF.llm.health(function (h) {
            var el = document.getElementById('sf-set-ai');
            if (!el) return;
            var bd = document.getElementById('sf-set-build');
            var meta = document.querySelector('meta[name=sf-build]');
            if (bd) bd.textContent = (meta ? meta.content : '旧版页面，请刷新') + (h && meta && h.build !== meta.content ? '（服务端有更新，请刷新页面）' : '');
            el.textContent = !h ? '本地服务未连接' : (h.claude ? 'Claude 订阅（' + h.model + '）' : '未找到 claude 命令');
        });

        SF.voice.roles(function (d) {
            var box = document.getElementById('sf-set-roles');
            if (!box) return;
            if (!d || !d.available) { box.textContent = '未安装语音组件（pip install edge-tts）'; return; }
            SF.voice.voices(function (list) {
                box.innerHTML = '';
                ROLES.forEach(function (r) {
                    var info = d.roles[r.id];
                    if (!info) return;
                    var cur = (SF.voice.get('voices') || {})[r.id] || info.voice;   // 当前生效的声音
                    var row = document.createElement('div');
                    row.className = 'sf-role-row';
                    var lab = document.createElement('span');
                    lab.textContent = r.name;
                    var sel = document.createElement('select');
                    list.forEach(function (v) {
                        var o = document.createElement('option');
                        o.value = v.id;
                        o.textContent = v.label + (v.id === info.voice ? '（默认）' : '');
                        sel.appendChild(o);
                    });
                    sel.value = cur;
                    function play() { SF.voice.preview(r.id, SAMPLE[r.id]); }
                    sel.onchange = function () {
                        SF.voice.setRoleVoice(r.id, sel.value === info.voice ? '' : sel.value);
                        play();
                    };
                    var btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'sf-role-btn';
                    btn.textContent = '▶';
                    btn.onclick = play;
                    row.appendChild(lab); row.appendChild(sel); row.appendChild(btn);
                    box.appendChild(row);
                });
            });
        });
    };

})(StoryForge);
