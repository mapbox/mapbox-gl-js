import refProperties from './util/ref_properties';

import type {LayerSpecification} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stringify(obj: any) {
    if (typeof obj === 'number' || typeof obj === 'boolean' || typeof obj === 'string' || obj === undefined || obj === null)
        return JSON.stringify(obj);

    if (Array.isArray(obj)) {
        let str = '[';
        for (const val of obj) {
            str += `${stringify(val)},`;
        }
        return `${str}]`;
    }

    let str = '{';
    for (const key of Object.keys(obj).sort()) {
        str += `${key}:${stringify((obj)[key])},`;
    }
    return `${str}}`;
}

function getKey(layer: LayerSpecification) {
    let key = '';
    for (const k of refProperties) {
        // Ignore minzoom and maxzoom for model layers so that multiple model layers
        // referencing the same source (but with different zoom ranges) produce the same
        // key. This ensures they get grouped into a single bucket, preventing a scenario
        // where shared node data is serialized twice and triggers an assert in struct_array.ts.
        if (layer.type === 'model' && (k === 'minzoom' || k === 'maxzoom')) {
            continue;
        } else {
            key += `/${stringify(layer[k])}`;
        }
    }
    return key;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function containsKey(obj: any, key: string) {
    function recursiveSearch(item) {
        if (typeof item === 'string' && item === key) {
            return true;
        }

        if (Array.isArray(item)) {
            return item.some(recursiveSearch);
        }

        if (item && typeof item === 'object') {
            return Object.values(item).some(recursiveSearch);
        }

        return false;
    }
    return recursiveSearch(obj);
}

/**
 * Given an array of layers, return an array of arrays of layers where all
 * layers in each group have identical layout-affecting properties. These
 * are the properties that were formerly used by explicit `ref` mechanism
 * for layers: 'type', 'source', 'source-layer', 'minzoom', 'maxzoom',
 * 'filter', and 'layout'.
 *
 * The input is not modified. The output layers are references to the
 * input layers.
 *
 * @private
 * @param {Array<Layer>} layers
 * @param {Object} [cachedKeys] - an object to keep already calculated keys.
 * @returns {Array<Array<Layer>>}
 */
export default function groupByLayout(
    layers: Array<LayerSpecification>,
    cachedKeys: {
        [id: string]: string;
    },
): Array<Array<LayerSpecification>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groups: Record<string, any> = {};

    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        let k = cachedKeys && cachedKeys[layer.id];

        if (!k) {
            // Do not group symbol layers together, as their paint properties affect placement
            if (layer.type === 'symbol') {
                k = layer.id;
            } else {
                k =  getKey(layer);
                // The usage of "line-progress" inside "line-width" makes the property act like a layout property.
                // We need to split it from the group to avoid conflicts in the bucket creation.
                if (layer.type === 'line' && layer["paint"]) {
                    const lineWidth = layer["paint"]['line-width'];
                    if (containsKey(lineWidth, 'line-progress')) {
                        k += `/${stringify(layer["paint"]['line-width'])}`;
                    }
                }
            }
        }

        // update the cache if there is one
        if (cachedKeys)
            cachedKeys[layer.id] = k;

        let group = groups[k];
        if (!group) {
            group = groups[k] = [];
        }
        group.push(layer);
    }

    const result = [];

    for (const k in groups) {
        result.push(groups[k]);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
}
