/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import deref from '../deref';

function eachLayer(style, callback) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    for (const k in style.layers) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        callback(style.layers[k]);
    }
}

export default function (style) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    style.version = 9;

    // remove user-specified refs
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    style.layers = deref(style.layers);

    // remove class-specific paint properties
    eachLayer(style, (layer) => {
        for (const k in layer) {
            if (/paint\..*/.test(k)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                delete layer[k];
            }
        }
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return style;
}
