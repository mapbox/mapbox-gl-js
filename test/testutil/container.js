'use strict';

module.exports = Container;

function Container(width, height) {
    this.offsetWidth = width;
    this.offsetHeight = height;

    this.classList = {
        add: function() {}
    };

    this.appendChild = function() {};
}
