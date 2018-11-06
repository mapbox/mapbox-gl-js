// @flow

import { getJSON, getImage, ResourceType } from '../util/ajax';

import browser from '../util/browser';
import { normalizeSpriteURL } from '../util/mapbox';
import { RGBAImage } from '../util/image';

import type {StyleImage} from './style_image';
import type {RequestTransformFunction} from '../ui/map';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';

import Protobuf from 'pbf';

function parseBinaryManifest(data: ArrayBuffer) {
    return new Protobuf(data).readFields((tag: number, manifest: Object, pbf: Protobuf) => {
        if (tag === 1) {
            let id;
            const img = pbf.readMessage((tag: number, img: Object, pbf: Protobuf) => {
                if (tag === 1) id = pbf.readString();
                else if (tag === 2) img.width = pbf.readVarint();
                else if (tag === 3) img.height = pbf.readVarint();
                else if (tag === 4) img.x = pbf.readVarint();
                else if (tag === 5) img.y = pbf.readVarint();
                else if (tag === 6) img.pixelRatio = pbf.readFloat();
                else if (tag === 7) img.sdf = pbf.readBoolean();
            }, { pixelRatio: 1 });
            if (id) {
                manifest[id] = img;
            }
        }
    }, {});
}

export default function(baseURL: string,
                          transformRequestCallback: RequestTransformFunction,
                          callback: Callback<{[string]: StyleImage}>): Cancelable {
    let json: any, image;
    const format = browser.devicePixelRatio > 1 ? '@2x' : '';

    let request = null;
    request = getImage(transformRequestCallback(normalizeSpriteURL(baseURL, format, '.png'), ResourceType.SpriteImage), (err: ?Error, img: ?HTMLImageElement, data: ?ArrayBuffer) => {
        request = null;
        if (err) {
            callback(err);
            return;
        }
        if (!img || !data) {
            callback(new Error('failed to load sprite'));
            return;
        }
        image = img;

        // Try to extract the JSON manifest from the PNG image in a special 'mbSM' (Mapbox sprite manifest) chunk.
        const png = new DataView(data);
        if (png.getUint32(0) === 0x89504E47 && png.getUint32(4) === 0xD0A1A0A) {
            for (let i = 8; i < png.byteLength;) {
                const length = png.getUint32(i);
                if (png.getUint32(i + 4) === 0x6D62534D /* mbSM */) {
                    try {
                        json = parseBinaryManifest(data.slice(i + 8, i + 8 + length));
                    } catch (err) {
                        callback(err);
                        return;
                    }
                    break;
                }
                i += length + 12;
            }
        }

        if (json) {
            complete();
        } else {
            // If the sprite didn't contain an embedded manifest, we'll try loading a separate JSON manifest.
            request = getJSON(transformRequestCallback(normalizeSpriteURL(baseURL, format, '.json'), ResourceType.SpriteJSON), (err: ?Error, data: ?Object) => {
                request = null;
                if (err) {
                    return callback(err);
                }
                json = data;
                complete();
            });
        }
    });

    function complete() {
        const imageData = browser.getImageData(image);
        const result = {};

        for (const id in json) {
            const {width, height, x, y, sdf, pixelRatio} = json[id];
            const data = new RGBAImage({width, height});
            RGBAImage.copy(imageData, data, {x, y}, {x: 0, y: 0}, {width, height});
            result[id] = {data, pixelRatio, sdf};
        }

        callback(null, result);
    }

    return {
        cancel() {
            if (request) {
                request.cancel();
                request = null;
            }
        }
    };
}
