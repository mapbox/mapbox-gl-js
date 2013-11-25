'use strict';

var evented = require('../lib/evented.js');

module.exports = ImageSprite;
evented(ImageSprite);
function ImageSprite(base) {
    var sprite = this;

    sprite.base = base;

    var xhr = new XMLHttpRequest();
    xhr.open("GET", sprite.base + '.json', true);
    xhr.onload = function(e) {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
            sprite.data = JSON.parse(xhr.response);
            if (sprite.dimensions) {
                sprite.loaded = true;
                sprite.fire('loaded');
            }
        }
    };
    xhr.send();

    sprite.loadImage();
}

ImageSprite.prototype.loadImage = function(callback) {
    var sprite = this;
    sprite.retina = window.devicePixelRatio > 1;

    if (sprite.img) delete sprite.img.onload;

    sprite.img = new Image();
    delete sprite.dimensions;
    sprite.loaded = false;
    sprite.img.onload = function() {
        var pixelRatio = sprite.retina ? 2 : 1;
        sprite.dimensions = {
            width: sprite.img.width / pixelRatio,
            height: sprite.img.height / pixelRatio
        };

        if (sprite.data) {
            sprite.loaded = true;
            if (callback) callback();
            sprite.fire('loaded');
        }
    };
    this.img.src = sprite.base + (sprite.retina ? '@2x.png' : '.png');
};

ImageSprite.prototype.toJSON = function() {
    return this.base;
};

ImageSprite.prototype.resize = function(gl) {
    var sprite = this;
    if (window.devicePixelRatio > 1 !== sprite.retina) {
        sprite.loadImage(function() {
            if (sprite.texture) {
                gl.deleteTexture(sprite.texture);
                delete sprite.texture;
            }
        });
    }
};

ImageSprite.prototype.cssRules = function() {
    var sprite = this;
    if (!this.loaded) return '';

    var rules = [];
    rules.push('.sprite-icon { background-image:url(' + sprite.base + '.dark.png); background-size:' + sprite.dimensions.width + 'px ' + sprite.dimensions.height + 'px; }');
    rules.push('@media only screen and (min-device-pixel-ratio: 1.5), only screen and (-webkit-min-device-pixel-ratio: 1.5) {' +
        '.sprite-icon { background-image:url(' + sprite.base + '.dark@2x.png); }' +
    '}');

    for (var key in this.data) {
        var icon = this.data[key];
        for (var size in icon.sizes) {
            rules.push('.sprite-icon-' + key + '-' + size + ' { background-position:' + -icon.sizes[size].x + 'px ' + -icon.sizes[size].y + 'px; }');
        }
    }

    return rules.join('\n');
};

ImageSprite.prototype.search = function(text) {
    text = String(text).toLowerCase().trim();
    var result = [];
    for (var key in this.data) {
        var tags = this.data[key].tags;
        for (var i = 0; i < tags.length; i++) {
            if (tags[i].indexOf(text) >= 0) {
                result.push(key);
                break;
            }
        }
    }
    return result;
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

ImageSprite.prototype.getPosition = function(name, size) {
    var pos = this.data && this.data[name] && this.data[name].sizes[size];
    if (pos && this.dimensions) {
        return {
            size: [size * window.devicePixelRatio, size * window.devicePixelRatio],
            tl: [pos.x / this.dimensions.width, pos.y / this.dimensions.height],
            br: [(pos.x + size) / this.dimensions.width, (pos.y + size) / this.dimensions.height]
        };
    }
};
