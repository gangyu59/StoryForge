(function (SF) {

    SF.ui = SF.ui || {};
    SF.ui.journey = SF.ui.journey || {};

    function parse(text) {
        function block(name) {
            var m = text.split("【" + name + "】")[1];
            if (!m) return "";
            return m.split("【")[0].trim();
        }

        return {
            scene: block("场景"),
            dialogue: block("对话"),
            choices: block("选择").split("\n").filter(Boolean)
        };
    }

    function avatar(id) {
        // 你以后可以换成真实图片
        return `background-image: radial-gradient(circle at top left, #fff, #666);`;
    }

    SF.ui.journey.render = function (text) {
        var app = document.querySelector(".sf-main") || document.getElementById("app");
        app.innerHTML = `<div class="sf-journey"></div>`;

        var wrap = app.querySelector(".sf-journey");
        var data = parse(text);

        // 场景
        var scene = document.createElement("div");
        scene.className = "j-card j-scene";
        scene.textContent = data.scene;
        wrap.appendChild(scene);

        // 时间提示
        var time = document.createElement("div");
        time.className = "j-time";
        time.textContent = "时间在推进……";
        wrap.appendChild(time);

        // 对话
        data.dialogue.split("\n").forEach(function (line) {
            var p = line.split("：");
            if (p.length < 2) return;

            var name = p[0];
            var content = p.slice(1).join("：");

            var id =
                name.indexOf("周") >= 0 ? "zhou" :
                name.indexOf("林") >= 0 ? "lin" : "fang";

            var row = document.createElement("div");
            row.className = "j-dialogue";

            var av = document.createElement("div");
            av.className = "j-avatar";
            av.style = avatar(id);

            var bubble = document.createElement("div");
            bubble.className = "j-bubble j-" + id;
            bubble.textContent = content;

            row.appendChild(av);
            row.appendChild(bubble);
            wrap.appendChild(row);
        });

        // 选择
        data.choices.forEach(function (c) {
            var div = document.createElement("div");
            div.className = "j-choice";
            div.textContent = c;
            div.onclick = function () {
                wrap.innerHTML = `<div class="j-card thinking">他们正在继续这段旅程……</div>`;
                SF.journey.next(c, SF.ui.journey.render);
            };
            wrap.appendChild(div);
        });
    };

})(StoryForge);