(function (SF) {

    SF.ui = SF.ui || {};

    SF.ui.renderCustomTheme = function () {

        var main = document.querySelector('.sf-main');
        if (!main) return;

        // 页面内容：三艘“浮起来的船” + 提示
        main.innerHTML = `
            <div class="sf-custom-theme" style="padding:20px 18px 90px 18px;">
                <h2 style="margin:6px 0 14px 0; font-size:20px;">你想进入一个怎样的世界？</h2>

                <div style="opacity:.85; line-height:1.6; margin-bottom:12px;">
                    点击一艘“船”会把样板填入输入框，你也可以自己写。
                </div>

                <div class="sf-ship-list" style="
                    display:flex;
                    flex-direction:column;
                    gap:12px;
                    margin:12px 0 14px 0;
                ">
                    <div class="sf-ship-card" data-sample="和三个朋友在火星殖民地长期生活。资源有限，关系微妙，未来未知。" style="
                        border-radius:14px;
                        padding:14px 14px;
                        background:rgba(255,255,255,.06);
                        box-shadow:0 10px 28px rgba(0,0,0,.25);
                        backdrop-filter: blur(6px);
                    ">
                        <div style="font-size:18px; margin-bottom:6px;">🚀 火星 · 殖民生存</div>
                        <div style="opacity:.85; line-height:1.55;">
                            和三个朋友在火星殖民地长期生活。资源有限，关系微妙，未来未知。
                        </div>
                    </div>

                    <div class="sf-ship-card" data-sample="我们组成一支公路乐队巡演，城市与城市之间有冲突、有温柔、有意外走红的机会。" style="
                        border-radius:14px;
                        padding:14px 14px;
                        background:rgba(255,255,255,.06);
                        box-shadow:0 10px 28px rgba(0,0,0,.25);
                        backdrop-filter: blur(6px);
                    ">
                        <div style="font-size:18px; margin-bottom:6px;">🎸 公路 · 乐队巡演</div>
                        <div style="opacity:.85; line-height:1.55;">
                            我们组成一支公路乐队巡演，城市与城市之间有冲突、有温柔、有意外走红的机会。
                        </div>
                    </div>

                    <div class="sf-ship-card" data-sample="未来沉没之城的水面之下，我们潜入废墟寻找真相。氧气有限，信任也有限。" style="
                        border-radius:14px;
                        padding:14px 14px;
                        background:rgba(255,255,255,.06);
                        box-shadow:0 10px 28px rgba(0,0,0,.25);
                        backdrop-filter: blur(6px);
                    ">
                        <div style="font-size:18px; margin-bottom:6px;">🌊 未来 · 沉没之城</div>
                        <div style="opacity:.85; line-height:1.55;">
                            未来沉没之城的水面之下，我们潜入废墟寻找真相。氧气有限，信任也有限。
                        </div>
                    </div>
                </div>

                <div style="opacity:.75; margin-top:10px;">
                    你写的这段话只用于“定义世界”，不会作为对话出现。
                </div>
            </div>
        `;

        // 绑定卡片点击：填入 Theme 输入框
        main.querySelectorAll('.sf-ship-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var sample = card.getAttribute('data-sample') || '';
                if (SF.ui.setThemeInputValue) {
                    SF.ui.setThemeInputValue(sample);
                }
            });
        });

        // 显示 Theme 输入框（与旅程对话输入彻底分离）
        if (!SF.ui.showThemeInput) {
            alert('Theme 输入模块未加载（input_theme_view.js）');
            return;
        }

        SF.ui.showThemeInput({
            onSubmit: function (text) {

                // 这里：只生成 theme，不进入对话
                if (!SF.journeyCustomBuilder || !SF.journeyCustomBuilder.build) {
                    alert('journeyCustomBuilder 未加载');
                    return;
                }

                SF.ui.showThinking && SF.ui.showThinking();

                SF.journeyCustomBuilder.build(
                    text,
                    function (theme) {
                        SF.ui.hideThinking && SF.ui.hideThinking();
                        if (!SF.ui._themeInputRef) return;   // 生成途中你已经点了返回：不再自动进入旅程

                        // 生成成功后：Theme 输入框必须消失
                        SF.ui.hideThemeInput && SF.ui.hideThemeInput();

                        // 清掉“定义世界”的介绍页，只留下故事
                        var m = document.querySelector('.sf-main');
                        if (m) m.innerHTML = '';
                        if (SF.ui.setJourneyTitle) SF.ui.setJourneyTitle(theme.title);

                        // 注入新 theme
                        SF.journeyThemes = SF.journeyThemes || {};
                        SF.journeyThemes[theme.id] = theme;

                        // 自动保存：以后在首页“我的世界”里直接进入
                        SF.worlds.save(theme).then(function (ok) {
                            if (!ok && SF.ui.toast) SF.ui.toast('世界没能保存下来，本次仍可正常游玩');
                        });

                        // 进入旅程：显示“对话输入框”，并启动
                        if (SF.ui.renderInputBox) {
                            SF.ui.renderInputBox();
                        }
                        if (SF.journey && SF.journey.startWithTheme) {
                            SF.journey.startWithTheme(theme.id);
                            if (SF.listen && SF.voice.get('listen')) SF.listen.start();
                        } else {
                            alert('Journey Engine 未加载（startWithTheme 不存在）');
                        }
                    },
                    function (err) {
                        SF.ui.hideThinking && SF.ui.hideThinking();
                        SF.ui.toast('世界没生成成功：' + err + '。可以改一改描述再试一次');
                    }
                );
            }
        });
    };

})(StoryForge);