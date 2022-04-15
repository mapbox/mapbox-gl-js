// @flow

import type {LayerSpecification} from './types.js';

import refProperties from './util/ref_properties.js';

function stringify(obj) {
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
        str += `${key}:${stringify((obj: any)[key])},`;
    }
    return `${str}}`;
}

function getKey(layer) {
    let key = '';
    for (const k of refProperties) {
        key += `/${stringify((layer: any)[k])}`;
    }
    return key;
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
export default function groupByLayout(layers: Array<LayerSpecification>, cachedKeys: {[id: string]: string}): Array<Array<LayerSpecification>> {
    const groups = {};

    for (let i = 0; i < layers.length; i++) {

        const k = (cachedKeys && cachedKeys[layers[i].id]) || getKey(layers[i]);
        // update the cache if there is one
        if (cachedKeys)
            cachedKeys[layers[i].id] = k;

        let group = groups[k];
        if (!group) {
            group = groups[k] = [];
        }
        group.push(layers[i]);
    }

    const result = [];

    for (const k in groups) {
        result.push(groups[k]);
    }

    return result;
}
