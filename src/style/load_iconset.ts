import Protobuf from 'pbf';
import {getArrayBuffer, ResourceType} from "../util/ajax";
import {readIconSet, type Icon} from "../data/usvg/usvg_pb_decoder";
import browser from '../util/browser';

import type {Callback} from "../types/callback";
import type {RequestManager} from "../util/mapbox";
import type {StyleImage, StyleImages} from "./style_image";

function getContentArea(icon: Icon): [number, number, number, number] | undefined {
    if (!icon.metadata || !icon.metadata.content_area) {
        return undefined;
    }

    const dpr = browser.devicePixelRatio;
    const {left, top, width, height} = icon.metadata.content_area;

    const scaledLeft = left * dpr;
    const scaledTop = top * dpr;

    return [
        scaledLeft,
        scaledTop,
        scaledLeft + width * dpr,
        scaledTop + height * dpr
    ];
}

function getStretchArea(stretchArea: [number, number][] | undefined): [number, number][] | undefined {
    if (!stretchArea) {
        return undefined;
    }

    return stretchArea.map(([l, r]) => [l * browser.devicePixelRatio, r * browser.devicePixelRatio]);
}

export function loadIconset(
    loadURL: string,
    requestManager: RequestManager,
    callback: Callback<StyleImages>
) {
    return getArrayBuffer(requestManager.transformRequest(requestManager.normalizeIconsetURL(loadURL), ResourceType.Iconset), (err, data) => {
        if (err) {
            callback(err);
            return;
        }

        const result: Record<string, any> = {};

        const iconSet = readIconSet(new Protobuf(data));

        for (const icon of iconSet.icons) {
            const styleImage: StyleImage = {
                version: 1,
                pixelRatio: browser.devicePixelRatio,
                content: getContentArea(icon),
                stretchX: icon.metadata ? getStretchArea(icon.metadata.stretch_x_areas) : undefined,
                stretchY: icon.metadata ? getStretchArea(icon.metadata.stretch_y_areas) : undefined,
                sdf: false,
                usvg: true,
                icon,
            };

            result[icon.name] = styleImage;
        }

        callback(null, result);
    });
}
