// @flow

const Evented = require('../util/evented');
const ajax = require('../util/ajax');
const browser = require('../util/browser');
const normalizeURL = require('../util/mapbox').normalizeSpriteURL;

class SpritePosition {
    x: number;
    y: number;
    width: number;
    height: number;
    pixelRatio: number;
    sdf: boolean;

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
    base: string;
    retina: boolean;

    data: ?{[string]: SpritePosition};
    imgData: ?HTMLImageElement;
    width: ?number;

    constructor(base: string, eventedParent?: Evented) {
        super();
        this.base = base;
        this.retina = browser.devicePixelRatio > 1;
        this.setEventedParent(eventedParent);

        const format = this.retina ? '@2x' : '';

        ajax.getJSON(normalizeURL(base, format, '.json'), (err, data) => {
            if (err) {
                this.fire('error', {error: err});
            } else if (data) {
                this.data = (data : any);
                if (this.imgData) this.fire('data', {dataType: 'style'});
            }
        });

        ajax.getImage(normalizeURL(base, format, '.png'), (err, img) => {
            if (err) {
                this.fire('error', {error: err});
            } else if (img) {
                this.imgData = browser.getImageData(img);

                this.width = img.width;

                if (this.data) this.fire('data', {dataType: 'style'});
            }
        });
    }

    toJSON() {
        return this.base;
    }

    loaded() {
        return !!(this.data && this.imgData);
    }

    resize(/*gl*/) {
        if (browser.devicePixelRatio > 1 !== this.retina) {
            const newSprite = new ImageSprite(this.base);
            newSprite.on('data', () => {
                this.data = newSprite.data;
                this.imgData = newSprite.imgData;
                this.width = newSprite.width;
                this.retina = newSprite.retina;
            });
        }
    }

    getSpritePosition(name: string) {
        if (!this.loaded()) return new SpritePosition();

        const pos = this.data && this.data[name];
        if (pos && this.imgData) return pos;

        return new SpritePosition();
    }
}

module.exports = ImageSprite;
