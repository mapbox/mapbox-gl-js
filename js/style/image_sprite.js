'use strict';

var Evented = require('../util/evented');
var ajax = require('../util/ajax');
var browser = require('../util/browser');

module.exports = ImageSprite;

function ImageSprite(base) {
    this.base = base;
    this.retina = browser.devicePixelRatio > 1;

    base = this.base + (this.retina ? '@2x' : '');

    ajax.getJSON(base + '.json', (err, data) => {
        // @TODO handle errors via sprite event.
        if (err) return;
        this.data = data;
        if (this.img) this.fire('loaded');
    });

    ajax.getImage(base + '.png', (err, img) => {
        // @TODO handle errors via sprite event.
        if (err) return;

        // premultiply the sprite
        var data = img.getData();
        var newdata = img.data = new Uint8Array(data.length);
        for (var i = 0; i < data.length; i+=4) {
            var alpha = data[i + 3] / 255;
            newdata[i + 0] = data[i + 0] * alpha;
            newdata[i + 1] = data[i + 1] * alpha;
            newdata[i + 2] = data[i + 2] * alpha;
            newdata[i + 3] = data[i + 3];
        }

        this.img = img;
        if (this.data) this.fire('loaded');
    });
}

ImageSprite.prototype = Object.create(Evented);

ImageSprite.prototype.toJSON = function() {
    return this.base;
};

ImageSprite.prototype.loaded = function() {
    return !!(this.data && this.img);
};

ImageSprite.prototype.resize = function(gl) {
    if (browser.devicePixelRatio > 1 !== this.retina) {
        var newSprite = new ImageSprite(this.base);
        newSprite.on('loaded', function() {
            this.img = newSprite.img;
            this.data = newSprite.data;
            this.retina = newSprite.retina;

            if (this.texture) {
                gl.deleteTexture(this.texture);
                delete this.texture;
            }
        }.bind(this));
    }
};

ImageSprite.prototype.bind = function(gl, linear) {
    if (!this.loaded())
        return;

    if (!this.texture) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        var img = this.img;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }

    var filter = linear ? gl.LINEAR : gl.NEAREST;
    if (filter !== this.filter) {
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
    if (pos && this.img) {
        var width = this.img.width;
        var height = this.img.height;
        return {
            size: [pos.width / pos.pixelRatio, pos.height / pos.pixelRatio],
            tl: [(pos.x + repeating)/ width, (pos.y + repeating) / height],
            br: [(pos.x + pos.width - 2 * repeating) / width, (pos.y + pos.height - 2 * repeating) / height]
        };
    }
};
