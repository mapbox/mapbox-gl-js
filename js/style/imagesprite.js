'use strict';

var evented = require('../lib/evented.js');

module.exports = ImageSprite;
evented(ImageSprite);

function ImageSprite(base) {

    var sprite = this;
    this.base = base;
    this.retina = window.devicePixelRatio > 1;

    // Load JSON
    var xhr = new XMLHttpRequest();
    xhr.open("GET", sprite.base + (sprite.retina ? '@2x' : '') + '.json', true);
    xhr.onload = function(e) {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
            sprite.data = JSON.parse(xhr.response);
            if (sprite.img.complete) sprite.fire('loaded');
        }
    };
    xhr.send();

    // Load Image
    sprite.img = new Image();
    sprite.img.onload = function() {
        if (sprite.data) sprite.fire('loaded');
    };
    this.img.src = sprite.base + (sprite.retina ? '@2x.png' : '.png');
}

ImageSprite.prototype.toJSON = function() {
    return this.base;
};

ImageSprite.prototype.resize = function(gl) {
    var sprite = this;
    if (window.devicePixelRatio > 1 !== sprite.retina) {

        var newSprite = new ImageSprite(sprite.base);
        newSprite.on('loaded', function() {

            sprite.img = newSprite.img;
            sprite.data = newSprite.data;
            sprite.retina = newSprite.retina;

            if (sprite.texture) {
                gl.deleteTexture(sprite.texture);
                delete sprite.texture;
            }

        });
    }
};

ImageSprite.prototype.bind = function(gl, linear) {
    var sprite = this;
    if (!sprite.texture) {
        sprite.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, sprite.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sprite.img);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, sprite.texture);
    }

    var filter = linear ? gl.LINEAR : gl.NEAREST;
    if (filter !== sprite.filter) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    }
};

ImageSprite.prototype.getPosition = function(name, repeating) {

    // `repeating` indicates that the image will be used in a repeating pattern
    // repeating pattern images are assumed to have a 1px padding that mirrors the opposite edge
    // positions for repeating images are adjusted to exclude the edge
    repeating = repeating === true ? 1 : 0;

    var pos = this.data && this.data[name];
    if (pos && this.img.complete) {
        var width = this.img.width;
        var height = this.img.height;
        var pixelRatio = ((this.retina ? 2 : 1) / pos.pixelRatio) || 1;
        return {
            size: [pos.width, pos.height],
            tl: [(pos.x + repeating)/ width, (pos.y + repeating) / height],
            br: [(pos.x + pos.width - 2 * repeating) / width, (pos.y + pos.height - 2 * repeating) / height]
        };
    }
};
