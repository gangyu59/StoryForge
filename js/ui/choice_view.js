(function (SF) {

    SF.ui = SF.ui || {};

    SF.ui.renderChoices = function (choices) {
        var container = document.getElementById('sf-choices');
        if (!container) return;

        container.innerHTML = '';

        choices.forEach(function (choice) {
            var btn = document.createElement('button');
            btn.className = 'sf-choice-btn';
            btn.textContent = choice.label;

            btn.addEventListener('click', function () {
                if (SF.game && SF.game.choices && SF.game.choices.handle) {
                    SF.game.choices.handle(choice.id);
                }
            });

            container.appendChild(btn);
        });
    };

})(StoryForge);