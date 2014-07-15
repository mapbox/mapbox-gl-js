'use strict';

var Evented = require('../util/evented.js');
var getJSON = require('../util/ajax.js').getJSON;
var browser = require('../util/browser.js');

module.exports = ImageSprite;

function ImageSprite(base) {

    var sprite = this;
    this.base = base;
    this.retina = browser.devicePixelRatio > 1;

    // Load JSON
    getJSON(sprite.base + (sprite.retina ? '@2x' : '') + '.json', function(err, data) {
        // @TODO handle errors via sprite event.
        if (err) return;
        sprite.data = data;
        if (sprite.img.complete) sprite.fire('loaded');
    });

    // Load Image
    sprite.img = new Image();
    sprite.img.crossOrigin = 'Anonymous';
    sprite.img.onload = function() {
        if (sprite.data) sprite.fire('loaded');
    };
    this.img.src = sprite.base + (sprite.retina ? '@2x.png' : '.png');
}

ImageSprite.prototype = Object.create(Evented);

ImageSprite.prototype.toJSON = function() {
    return this.base;
};

ImageSprite.prototype.resize = function(gl) {
    var sprite = this;
    if (browser.devicePixelRatio > 1 !== sprite.retina) {

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
        return {
            size: [pos.width / pos.pixelRatio, pos.height / pos.pixelRatio],
            tl: [(pos.x + repeating)/ width, (pos.y + repeating) / height],
            br: [(pos.x + pos.width - 2 * repeating) / width, (pos.y + pos.height - 2 * repeating) / height]
        };
    }
};
