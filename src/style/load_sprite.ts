import {getJSON, getImage, ResourceType} from '../util/ajax';
import browser from '../util/browser';
import {RGBAImage} from '../util/image';

import type {StyleImages} from './style_image';
import type {RequestManager} from '../util/mapbox';
import type {Callback} from '../types/callback';

type SpriteData = Record<string, {
    width: number;
    height: number;
    x: number;
    y: number;
    sdf?: boolean;
    pixelRatio?: number;
    stretchX?: Array<[number, number]>;
    stretchY?: Array<[number, number]>;
    content?: [number, number, number, number];
}>;

export default function (
    baseURL: string,
    requestManager: RequestManager,
    signal: AbortSignal,
    callback: Callback<StyleImages>,
) {
    let json: SpriteData | undefined, image: ImageBitmap | undefined, error: Error | undefined;
    const format = browser.devicePixelRatio > 1 ? '@2x' : '';

    function settle(err: Error | undefined) {
        // Stay silent only on our own cancellation (signal.aborted), not on a user transform's own rejection.
        if (error || (err && signal.aborted)) return;
        if (err) error = err;
        maybeComplete();
    }

    async function loadJSON() {
        const requestParameters = await requestManager.transformRequest(requestManager.normalizeSpriteURL(baseURL, format, '.json'), ResourceType.SpriteJSON, signal);
        const {data} = await getJSON<SpriteData>(requestParameters, signal);
        if (!error) json = data;
    }

    async function loadImage() {
        const requestParameters = await requestManager.transformRequest(requestManager.normalizeSpriteURL(baseURL, format, '.png'), ResourceType.SpriteImage, signal);
        const {data} = await getImage(requestParameters, signal);
        if (!error) image = data;
    }

    loadJSON().then(() => settle(undefined), (err: Error) => settle(err));
    loadImage().then(() => settle(undefined), (err: Error) => settle(err));

    function maybeComplete() {
        if (error) {
            callback(error);
        } else if (json && image) {
            const imageData = browser.getImageData(image);
            const result: StyleImages = {};

            for (const id in json) {
                const {width, height, x, y, sdf, pixelRatio, stretchX, stretchY, content} = json[id];
                const data = new RGBAImage({width, height});
                RGBAImage.copy(imageData, data, {x, y}, {x: 0, y: 0}, {width, height}, null);
                result[id] = {
                    data,
                    pixelRatio: pixelRatio !== undefined ? pixelRatio : 1,
                    sdf: sdf !== undefined ? sdf : false,
                    stretchX,
                    stretchY,
                    content,
                    usvg: false,
                    version: 0
                };
            }

            callback(null, result);
        }
    }
}
