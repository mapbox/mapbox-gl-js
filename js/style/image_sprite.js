'use strict';

const Evented = require('../util/evented');
const ajax = require('../util/ajax');
const browser = require('../util/browser');
const normalizeURL = require('../util/mapbox').normalizeSpriteURL;

class SpritePosition {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
        this.pixelRatio = 1;
        this.sdf = false;
    }
}

class ImageSprite extends Evented {

    constructor(base) {
        super();
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
            for (let i = 0; i < img.data.length; i += 4) {
                const alpha = img.data[i + 3] / 255;
                img.data[i + 0] *= alpha;
                img.data[i + 1] *= alpha;
                img.data[i + 2] *= alpha;
            }

            this.img = img;
            if (this.data) this.fire('data', {dataType: 'style'});
        });
    }

    toJSON() {
        return this.base;
    }

    loaded() {
        return !!(this.data && this.img);
    }

    resize(/*gl*/) {
        if (browser.devicePixelRatio > 1 !== this.retina) {
            const newSprite = new ImageSprite(this.base);
            newSprite.on('data', () => {
                this.img = newSprite.img;
                this.data = newSprite.data;
                this.retina = newSprite.retina;
            });
        }
    }

    getSpritePosition(name) {
        if (!this.loaded()) return new SpritePosition();

        const pos = this.data && this.data[name];
        if (pos && this.img) return pos;

        return new SpritePosition();
    }
}

module.exports = ImageSprite;
