'use strict';

exports.create = function (tagName, className, container) {
    return {
        offsetWidth: container ? container.offsetWidth : null,
        offsetHeight: container ? container.offsetHeight : null,
        remove: function () {},
        addEventListener: function() {},
        classList: {
            add: function () {}
        },
        appendChild: function () {}
    };
};

exports.setTransform = function() {};
