import deref from '../deref';

import type {LayerSpecification} from '../types';

type LegacyLayer = Record<string, unknown> & {id: string};
type LegacyStyle = {version: number; layers: LegacyLayer[]};

type Migrated<T> = Omit<T, 'version'> & {version: 9};

function eachLayer(style: LegacyStyle, callback: (layer: LegacyLayer) => void): void {
    // eslint-disable-next-line @typescript-eslint/no-for-in-array
    for (const k in style.layers) {
        callback(style.layers[k as unknown as number]!);
    }
}

export default function <T extends LegacyStyle>(style: T): Migrated<T> {
    style.version = 9;

    // remove user-specified refs
    style.layers = deref(style.layers as unknown as Array<LayerSpecification>);

    // remove class-specific paint properties
    eachLayer(style, (layer) => {
        for (const k in layer) {
            if (k.includes('paint.')) {
                delete layer[k];
            }
        }
    });

    return style as Migrated<T>;
}
