'use strict';

module.exports = function placeIcon(image, layout) {
    if (!image || !image.rect) return null;

    var dx = layout['icon-offset'][0];
    var dy = layout['icon-offset'][1];
    var x1 = dx - image.width / 2;
    var x2 = x1 + image.width;
    var y1 = dy - image.height / 2;
    var y2 = y1 + image.height;

    return {
        image: image,
        top: y1,
        bottom: y2,
        left: x1,
        right: x2
    };
};
