/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import reference from './reference/latest';
import stringifyPretty from 'json-stringify-pretty-compact';

function sortKeysBy(obj, reference) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    for (const key in reference) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (obj[key] !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            result[key] = obj[key];
        }
    }
    for (const key in obj) {
        if (result[key] === undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            result[key] = obj[key];
        }
    }
    return result;
}

/**
 * Format a Mapbox GL Style.  Returns a stringified style with its keys
 * sorted in the same order as the reference style.
 *
 * The optional `space` argument is passed to
 * [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
 * to generate formatted output.
 *
 * If `space` is unspecified, a default of `2` spaces will be used.
 *
 * @private
 * @param {Object} style a Mapbox GL Style
 * @param {number} [space] space argument to pass to `JSON.stringify`
 * @returns {string} stringified formatted JSON
 * @example
 * var fs = require('fs');
 * var format = require('mapbox-gl-style-spec').format;
 * var style = fs.readFileSync('./source.json', 'utf8');
 * fs.writeFileSync('./dest.json', format(style));
 * fs.writeFileSync('./dest.min.json', format(style, 0));
 */
function format(style, space = 2) {
    style = sortKeysBy(style, reference.$root);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (style.layers) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        style.layers = style.layers.map((layer) => sortKeysBy(layer, reference.layer));
    }

    return stringifyPretty(style, {indent: space});
}

export default format;
