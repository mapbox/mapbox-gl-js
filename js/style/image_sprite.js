'use strict';

const Evented = require('../util/evented');
const ajax = require('../util/ajax');
const browser = require('../util/browser');
const normalizeURL = require('../util/mapbox').normalizeSpriteURL;

module.exports = ImageSprite;

function ImageSprite(base) {
    this.base = base;
    this.retina = browser.devicePixelRatio > 1;

    const format = this.retina ? '@2x' : '';

    ajax.getJSON(normalizeURL(base, format, '.json'), (err, data) => {
        if (err) {
            this.fire('error', {error: err});
            return;
        }

        this.data = data;
        if (this.img) this.fire('data', {dataType: 'style'});
    });

    ajax.getImage(normalizeURL(base, format, '.png'), (err, img) => {
        if (err) {
            this.fire('error', {error: err});
            return;
        }

        // premultiply the sprite
        const data = img.getData();
        const newdata = img.data = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3] / 255;
            newdata[i + 0] = data[i + 0] * alpha;
            newdata[i + 1] = data[i + 1] * alpha;
            newdata[i + 2] = data[i + 2] * alpha;
            newdata[i + 3] = data[i + 3];
        }

        this.img = img;
        if (this.data) this.fire('data', {dataType: 'style'});
    });
}

ImageSprite.prototype = Object.create(Evented.prototype);

ImageSprite.prototype.toJSON = function() {
    return this.base;
};

ImageSprite.prototype.loaded = function() {
    return !!(this.data && this.img);
};

ImageSprite.prototype.resize = function(/*gl*/) {
    if (browser.devicePixelRatio > 1 !== this.retina) {
        const newSprite = new ImageSprite(this.base);
        newSprite.on('data', () => {
            this.img = newSprite.img;
            this.data = newSprite.data;
            this.retina = newSprite.retina;
        });
    }
};

function SpritePosition() {}
SpritePosition.prototype = { x: 0, y: 0, width: 0, height: 0, pixelRatio: 1, sdf: false };

ImageSprite.prototype.getSpritePosition = function(name) {
    if (!this.loaded()) return new SpritePosition();

    const pos = this.data && this.data[name];
    if (pos && this.img) return pos;

    return new SpritePosition();
};
