import reference from './reference/latest';
import stringifyPretty from 'json-stringify-pretty-compact';

type ObjectLike = Record<string, unknown>;

function sortKeysBy<T extends ObjectLike>(obj: T, reference: ObjectLike): T {
    const result: ObjectLike = {};
    for (const key in reference) {
        if (obj[key] !== undefined) {
            result[key] = obj[key];
        }
    }
    for (const key in obj) {
        if (result[key] === undefined) {
            result[key] = obj[key];
        }
    }
    return result as T;
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
function format(style: unknown, space = 2): string {
    const sorted = sortKeysBy(style as ObjectLike, reference.$root as ObjectLike) as {layers?: ObjectLike[]};

    if (sorted.layers) {
        sorted.layers = sorted.layers.map((layer) => sortKeysBy(layer, reference.layer as ObjectLike));
    }

    return stringifyPretty(sorted, {indent: space});
}

export default format;
