(function (SF) {

    if (!SF) return;
    SF.ui = SF.ui || {};

    /**
     * 对话输入栏：只有「输入框 + 发送」。
     * 说话不需要按钮——进入旅程后由常开聆听（SF.listen）自动听；
     * 聆听状态显示在输入框的提示语里。
     */
    var PLACEHOLDER = {
        off:       '说点什么…',
        listening: '我在听，直接说就行',
        hearing:   '听到你了…',
        busy:      '正在听清…',
        error:     '麦克风没开，先打字吧'
    };


    SF.ui.renderInputBox = function () {
        var old = document.querySelector('.sf-input-bar');
        if (old) old.remove();

        var bar = document.createElement('div');
        bar.className = 'sf-input-bar';

        var input = document.createElement('textarea');
        input.className = 'sf-input';
        input.rows = 1;
        input.placeholder = PLACEHOLDER.off;

        var sendBtn = document.createElement('button');
        sendBtn.className = 'sf-send-btn';
        sendBtn.type = 'button';
        sendBtn.textContent = '发送';

        function send() {
            var text = (input.value || '').trim();
            if (!text) return;
            input.value = '';
            if (SF.journey && SF.journey.onPlayerInput) SF.journey.onPlayerInput(text);
        }

        sendBtn.onclick = send;
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
        });

        bar.appendChild(input);
        bar.appendChild(sendBtn);
        document.body.appendChild(bar);
        if (SF.ui.trackKeyboard) SF.ui.trackKeyboard(bar);

        // 提示语随聆听状态变化；输入栏被替换后自动解除旧的绑定
        if (SF.listen) {
            SF.listen.onState(function (st) {
                if (!document.body.contains(input)) return;
                input.placeholder = PLACEHOLDER[st] || PLACEHOLDER.off;
                bar.classList.toggle('is-hearing', st === 'hearing');
                bar.classList.toggle('is-busy', st === 'busy');
            });
        }
    };

})(StoryForge);
