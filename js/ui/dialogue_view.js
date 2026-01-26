(function (SF) {

    SF.ui = SF.ui || {};

    let lastBubbleTextEl = null;

    function getAvatarById(avatarId, name) {
        var srcImg = document.getElementById(avatarId);
        if (!srcImg) return null;

        var img = document.createElement('img');
        img.className = 'sf-avatar';
        img.src = srcImg.src;
        img.alt = name || '';
        return img;
    }

    SF.ui.renderDialogue = function (msg) {
        var main = document.querySelector('.sf-main');
        if (!main) return;

        // ✅ 4 角色槽位 + system
        var ROLE = {
            sakura:   { name: '林之樱',  avatarId: 'avatar-sakura', cls: 'role-sakura' },
            jerry:    { name: '周行简',  avatarId: 'avatar-jerry',  cls: 'role-jerry' },
            kevin:    { name: '方野',    avatarId: 'avatar-kevin',  cls: 'role-kevin' },
            michelle: { name: 'Michelle', avatarId: 'avatar-you',   cls: 'role-player' },
            system:   { name: '', avatarId: null, cls: 'role-system' }
        };

        var roleDef = ROLE[msg.role] || ROLE.system;

        var row = document.createElement('div');
        row.className = 'sf-dialogue-row ' + roleDef.cls;

        // ===== system：纯描述，不进气泡 =====
        if (msg.role === 'system') {
            var sys = document.createElement('div');
            sys.className = 'sf-system-text';
            sys.textContent = msg.text;
            row.appendChild(sys);
            lastBubbleTextEl = null;
        }
        // ===== 人物：头像 + 气泡 =====
        else {
            var displayName = msg.displayName || roleDef.name;

            var avatar = getAvatarById(roleDef.avatarId, displayName);
            if (avatar) row.appendChild(avatar);

            var bubble = document.createElement('div');
            bubble.className = 'sf-bubble';

            var name = document.createElement('div');
            name.className = 'sf-name';
            name.textContent = displayName;

            var text = document.createElement('div');
            text.className = 'sf-text';
            text.textContent = msg.text || '';

            bubble.appendChild(name);
            bubble.appendChild(text);
            row.appendChild(bubble);

            lastBubbleTextEl = text;
        }

        main.appendChild(row);
        main.scrollTop = main.scrollHeight;
    };

    // ✅ 打字机用：更新最后一句
    SF.ui.updateLastDialogue = function (text) {
        if (lastBubbleTextEl) {
            lastBubbleTextEl.textContent = text;
        }
    };

})(StoryForge);