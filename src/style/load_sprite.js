// @flow

const ajax = require('../util/ajax');
const browser = require('../util/browser');
const {normalizeSpriteURL} = require('../util/mapbox');
const {RGBAImage} = require('../util/image');

import type {StyleImage} from './style_image';
import type {RequestTransformFunction} from '../ui/map';
import type {Callback} from '../types/callback';

module.exports = function(baseURL: string,
                          transformRequestCallback: RequestTransformFunction,
                          callback: Callback<{[string]: StyleImage}>) {
    let json: any, image, error;
    const format = browser.devicePixelRatio > 1 ? '@2x' : '';

    ajax.getJSON(transformRequestCallback(normalizeSpriteURL(baseURL, format, '.json'), ajax.ResourceType.SpriteJSON), (err, data) => {
        if (!error) {
            error = err;
            json = data;
            maybeComplete();
        }
    });

    ajax.getImage(transformRequestCallback(normalizeSpriteURL(baseURL, format, '.png'), ajax.ResourceType.SpriteImage), (err, img) => {
        if (!error) {
            error = err;
            image = img;
            maybeComplete();
        }
    });

    function maybeComplete() {
        if (error) {
            callback(error);
        } else if (json && image) {
            const imageData = browser.getImageData(image);
            const result = {};

            for (const id in json) {
                const {width, height, x, y, sdf, pixelRatio} = json[id];
                const data = RGBAImage.create({width, height});
                RGBAImage.copy(imageData, data, {x, y}, {x: 0, y: 0}, {width, height});
                result[id] = {data, pixelRatio, sdf};
            }

            callback(null, result);
        }
    }
};
