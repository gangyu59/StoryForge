(function (SF) {

    SF.ui = SF.ui || {};

    var TRIPS = [
        { id: 'kyoto',      icon: '🌸', title: '京都 · 赏樱之旅',   desc: '春天的古都，花雨里慢慢走' },
        { id: 'antarctica', icon: '🧊', title: '南极 · 探险之旅',   desc: '冰原、风暴，和彼此取暖' },
        { id: 'africa',     icon: '🦁', title: '非洲 · 动物大迁徙', desc: '追着季风，看一场壮阔迁徙' },
        { id: 'custom',     icon: '✨', title: '自己定一个世界',    desc: '用一句话，让 Claude 为你们搭一个舞台', secondary: true }
    ];

    var CAST = [
        { src: 'assets/Sakura.jpg', name: '林之樱' },
        { src: 'assets/Jerry.jpg',  name: '周行简' },
        { src: 'assets/Kevin.jpg',  name: '方野' }
    ];

    SF.ui.renderHome = function () {
        var main = document.querySelector('.sf-main');
        if (!main) return;

        main.innerHTML =
            '<div class="sf-home">' +
              '<div class="sf-cast">' +
                CAST.map(function (c) {
                    return '<div class="sf-cast-item"><img src="' + c.src + '" alt="' + c.name + '"><span>' + c.name + '</span></div>';
                }).join('') +
              '</div>' +
              '<h2 class="sf-home-title">想和朋友们去哪儿？</h2>' +
              '<p class="sf-home-sub">他们会说话，也会听你说。</p>' +
              '<div class="sf-trip-list">' +
                TRIPS.map(function (t) {
                    return '<button class="sf-trip' + (t.secondary ? ' sf-trip-secondary' : '') + '" data-theme="' + t.id + '">' +
                             '<span class="sf-trip-icon">' + t.icon + '</span>' +
                             '<span class="sf-trip-body"><b>' + t.title + '</b><small>' + t.desc + '</small></span>' +
                             '<span class="sf-trip-go">›</span>' +
                           '</button>';
                }).join('') +
              '</div>' +
              '<div id="sf-my-worlds"></div>' +
              '<div class="sf-status-line" id="sf-status-line">正在检查 Claude 连接…</div>' +
            '</div>';

        main.querySelectorAll('.sf-trip').forEach(function (btn) {
            btn.addEventListener('click', function () {
                SF.app.startJourney(btn.getAttribute('data-theme'));
            });
        });

        // 我的世界：自建过的场景，点一下直接进入
        SF.worlds.list(function (list) {
            var box = document.getElementById('sf-my-worlds');
            if (!box || !list.length) return;
            box.innerHTML = '<div class="sf-section-title">我的世界</div><div class="sf-trip-list" id="sf-my-list"></div>';
            var ul = document.getElementById('sf-my-list');
            list.forEach(function (t) {
                var b = document.createElement('div');
                b.className = 'sf-trip sf-trip-mine';
                b.setAttribute('role', 'button');
                b.innerHTML = '<span class="sf-trip-icon">🌍</span>' +
                    '<span class="sf-trip-body"><b></b><small></small></span>' +
                    '<button type="button" class="sf-trip-del" title="删除这个世界">✕</button>';
                b.querySelector('b').textContent = t.title;
                b.querySelector('small').textContent = t.desc || '自建世界';
                b.onclick = function () { SF.app.startJourney(t.id); };
                b.querySelector('.sf-trip-del').onclick = function (e) {
                    e.stopPropagation();
                    if (!confirm('删除「' + t.title + '」？删除后无法恢复。')) return;
                    SF.worlds.remove(t.id, function () { b.remove(); if (!ul.children.length) box.innerHTML = ''; });
                };
                ul.appendChild(b);
            });
        });

        // 连接状态：让用户一眼知道能不能玩
        SF.llm.health(function (h) {
            var el = document.getElementById('sf-status-line');
            if (!el) return;
            if (!h) {
                el.className = 'sf-status-line bad';
                el.textContent = '连不上本地服务，请用 “启动 StoryForge” 打开本页';
            } else if (!h.claude) {
                el.className = 'sf-status-line bad';
                el.textContent = '没找到 Claude 命令行：请先安装 Claude Code 并登录订阅账号';
            } else {
                el.className = 'sf-status-line ok';
                el.textContent = 'Claude 订阅已连接' + (h.tts ? ' · 角色语音就绪' : ' · 未安装语音组件（仅文字）');
            }
        });
    };

})(StoryForge);
