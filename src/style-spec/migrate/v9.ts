/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import deref from '../deref';

function eachLayer(style, callback) {
    for (const k in style.layers) {
        callback(style.layers[k]);
    }
}

export default function (style) {
    style.version = 9;

    // remove user-specified refs
    style.layers = deref(style.layers);

    // remove class-specific paint properties
    eachLayer(style, (layer) => {
        for (const k in layer) {
            if (/paint\..*/.test(k)) {
                delete layer[k];
            }
        }
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return style;
}
