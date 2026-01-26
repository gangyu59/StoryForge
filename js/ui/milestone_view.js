(function (SF) {

    SF.ui = SF.ui || {};

    SF.ui.showMilestone = function (milestone) {
        var main = document.querySelector('.sf-main');

        var el = document.createElement('div');
        el.className = 'sf-card sf-milestone';

        el.innerHTML = `
            <h4>◆ ${milestone.title}</h4>
            <p class="sf-muted">${milestone.impact}</p>
        `;

        main.appendChild(el);
    };

})(StoryForge);