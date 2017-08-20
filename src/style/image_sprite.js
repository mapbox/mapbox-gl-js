// @flow

const Evented = require('../util/evented');
const ajax = require('../util/ajax');
const browser = require('../util/browser');
const normalizeURL = require('../util/mapbox').normalizeSpriteURL;

import type {RequestTransformFunction} from '../ui/map';

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

    transformRequestFn: RequestTransformFunction;
    data: ?{[string]: SpritePosition};
    imgData: ?Uint8ClampedArray;
    width: ?number;

    constructor(base: string, transformRequestCallback: RequestTransformFunction, eventedParent?: Evented) {
        super();
        this.base = base;
        this.retina = browser.devicePixelRatio > 1;
        this.setEventedParent(eventedParent);
        this.transformRequestFn = transformRequestCallback;

        const format = this.retina ? '@2x' : '';
        let url = normalizeURL(base, format, '.json');
        const jsonRequest = transformRequestCallback(url, ajax.ResourceType.SpriteJSON);
        ajax.getJSON(jsonRequest, (err, data) => {
            if (err) {
                this.fire('error', {error: err});
            } else if (data) {
                this.data = (data: any);
                if (this.imgData) this.fire('data', {dataType: 'style'});
            }
        });
        url = normalizeURL(base, format, '.png');
        const imageRequest = transformRequestCallback(url, ajax.ResourceType.SpriteImage);
        ajax.getImage(imageRequest, (err, img) => {
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
            const newSprite = new ImageSprite(this.base, this.transformRequestFn);
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
