(function (SF) {

    SF.app = SF.app || {};

    document.addEventListener('DOMContentLoaded', function () {


        // ✅ 统一用 journey 体验（你不再需要身份/phase）
        SF.MODE = 'journey';

        // 2️⃣ 渲染 Layout
        SF.ui.renderLayout();

        // 3️⃣ 首页：显示 StoryForge（非 Home 图标）
        if (SF.ui.setHeaderLeftMode) SF.ui.setHeaderLeftMode(true);

        // 4️⃣ 顶部标题
        if (SF.ui.setJourneyTitle) SF.ui.setJourneyTitle('选择你的旅程');

        // 5️⃣ 渲染 Home 页面
        if (SF.ui.renderHome) SF.ui.renderHome();
    });

    /**
     * ✅ 回到首页（让用户重新选择）
     */
    SF.app.goHome = function () {
        if (SF.journey && SF.journey.stop) SF.journey.stop();
        var bar = document.querySelector('.sf-input-bar'); if (bar) bar.remove();
        if (SF.ui.hideThemeInput) SF.ui.hideThemeInput();
        if (SF.ui.hideThinking) SF.ui.hideThinking();
        SF.MODE = 'journey';
        SF.ui.renderLayout();

        // 首页显示 StoryForge
        if (SF.ui.setHeaderLeftMode) SF.ui.setHeaderLeftMode(true);

        // 标题
        if (SF.ui.setJourneyTitle) SF.ui.setJourneyTitle('选择你的旅程');

        // 渲染 home
        if (SF.ui.renderHome) SF.ui.renderHome();
    };

    /**
     * 🚀 统一 Journey 启动入口
     */
    SF.app.startJourney = function (themeId) {

        // 统一模式
        SF.MODE = 'journey';
        SF.ui.renderLayout();

        // 子页面显示 Home 图标
        if (SF.ui.setHeaderLeftMode) SF.ui.setHeaderLeftMode(false);

        // custom：进自定义主题生成页（不触发对话）
        if (themeId === 'custom') {
            if (SF.ui.setJourneyTitle) SF.ui.setJourneyTitle('主题 · 用户自定义');

            // 注意：这里仅展示“主题定义输入”，不会混入对话输入
            if (SF.ui.renderCustomTheme) {
                SF.ui.renderCustomTheme();
            } else {
                alert('renderCustomTheme 未加载');
            }
            return;
        }

        // 校验 theme
        if (!SF.journeyThemes || !SF.journeyThemes[themeId]) {
            alert('主题未找到：' + themeId);
            return;
        }

        var theme = SF.journeyThemes[themeId];
        var title = theme.title || theme.name || themeId;

        // 顶部主题标题
        if (SF.ui.setJourneyTitle) SF.ui.setJourneyTitle(title);

        // 渲染对话输入框
        if (SF.ui.renderInputBox) {
            SF.ui.renderInputBox();
        } else {
            alert('renderInputBox 未加载');
            return;
        }

        // 启动 Journey
        if (SF.journey && SF.journey.startWithTheme) {
            SF.journey.startWithTheme(themeId);
            // 进入旅程就开始聆听（可在页头 🎙 或设置里关闭）
            if (SF.listen && SF.voice.get('listen')) SF.listen.start();
        } else {
            alert('Journey Engine 未加载（startWithTheme 不存在）');
        }
    };

})(StoryForge);