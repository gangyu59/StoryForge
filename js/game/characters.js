(function (SF) {

    SF.game = SF.game || {};

    SF.game.characters = {
        sakura: {
            id: 'sakura',
            name: '林知樱',
            avatar: 'assets/Sakura.jpg',
            bubbleClass: 'bubble-sakura'
        },
        jerry: {
            id: 'jerry',
            name: '周行简',
            avatar: 'assets/Jerry.jpg',
            bubbleClass: 'bubble-jerry'
        },
        kevin: {
            id: 'kevin',
            name: '方野',
            avatar: 'assets/Kevin.jpg',
            bubbleClass: 'bubble-kevin'
        },
        player: {
            id: 'player',
            name: '你',
            avatar: 'assets/Michelle.jpg', // 暂用占位
            bubbleClass: 'bubble-player'
        }
    };

})(StoryForge);