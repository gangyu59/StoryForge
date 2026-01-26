(function (SF) {

    SF.ui = SF.ui || {};

    /**
     * 显示 AI 思考状态（不遮挡主页面）
     */
    SF.ui.showLoading = function () {
        var indicator = document.getElementById('sf-thinking-indicator');
        var status = document.getElementById('sf-status');

        if (indicator) {
            indicator.classList.remove('hidden');
        }

        if (status) {
            status.style.display = 'none';
        }
    };

    /**
     * 恢复 Ready 状态
     */
    SF.ui.hideLoading = function () {
        var indicator = document.getElementById('sf-thinking-indicator');
        var status = document.getElementById('sf-status');

        if (indicator) {
            indicator.classList.add('hidden');
        }

        if (status) {
            status.style.display = 'inline';
        }
    };

})(StoryForge);