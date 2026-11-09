import * as diff from 'diff';

/**
 * @param {string | object} expected
 * @param {string | object} actual
 * @returns {string}
 */
export function generateDiffLog(expected, actual) {
    return diff.diffJson(expected, actual).map((hunk) => {
        if (hunk.added) {
            return `+ ${hunk.value}`;
        } else if (hunk.removed) {
            return `- ${hunk.value}`;
        } else {
            return `  ${hunk.value}`;
        }
    }).join('');
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function deepEqual(a, b) {
    if (typeof a !== typeof b)
        return false;
    if (typeof a === 'number')
        return Math.abs(a - /** @type {number} */ (b)) < 1e-10;
    if (a === null || typeof a !== 'object')
        return a === b;

    const ka = Object.keys(a);
    const kb = Object.keys(b);

    if (ka.length !== kb.length)
        return false;

    ka.sort();
    kb.sort();

    for (let i = 0; i < ka.length; i++)
        if (ka[i] !== kb[i] || !deepEqual(/** @type {Record<string, unknown>} */ (a)[ka[i]], /** @type {Record<string, unknown>} */ (b)[ka[i]]))
            return false;

    return true;
}
