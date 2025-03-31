import {getJSON, getImage, ResourceType} from '../util/ajax';
import browser from '../util/browser';
import {RGBAImage} from '../util/image';

import type {StyleImages} from './style_image';
import type {RequestManager} from '../util/mapbox';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';

export default function(
    baseURL: string,
    requestManager: RequestManager,
    callback: Callback<StyleImages>,
): Cancelable {
    let json: any, image, error;
    const format = browser.devicePixelRatio > 1 ? '@2x' : '';

    let jsonRequest: Cancelable | null | undefined = getJSON(requestManager.transformRequest(requestManager.normalizeSpriteURL(baseURL, format, '.json'), ResourceType.SpriteJSON), (err?: Error | null, data?: object) => {
        jsonRequest = null;
        if (!error) {
            error = err;
            json = data;
            maybeComplete();
        }
    });

    let imageRequest: Cancelable | null | undefined = getImage(requestManager.transformRequest(requestManager.normalizeSpriteURL(baseURL, format, '.png'), ResourceType.SpriteImage), (err, img) => {
        imageRequest = null;
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
            const result: Record<string, any> = {};

            for (const id in json) {
                const {width, height, x, y, sdf, pixelRatio, stretchX, stretchY, content} = json[id];
                const data = new RGBAImage({width, height});
                RGBAImage.copy(imageData, data, {x, y}, {x: 0, y: 0}, {width, height}, null);
                result[id] = {data, pixelRatio, sdf, stretchX, stretchY, content, usvg: false};
            }

            callback(null, result);
        }
    }

    return {
        cancel() {
            if (jsonRequest) {
                jsonRequest.cancel();
                jsonRequest = null;
            }
            if (imageRequest) {
                imageRequest.cancel();
                imageRequest = null;
            }
        }
    };
}
