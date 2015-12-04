'use strict';

exports.create = function (tagName, className, container) {
    return {
        offsetWidth: container.offsetWidth,
        offsetHeight: container.offsetHeight,
        remove: function () {}
    };
};
