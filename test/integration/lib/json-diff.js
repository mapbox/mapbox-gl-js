import diff from 'diff';

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

export function deepEqual(a, b) {
    if (typeof a !== typeof b)
        return false;
    if (typeof a === 'number')
        return Math.abs(a - b) < 1e-10;
    if (a === null || typeof a !== 'object')
        return a === b;

    const ka = Object.keys(a);
    const kb = Object.keys(b);

    if (ka.length !== kb.length)
        return false;

    ka.sort();
    kb.sort();

    for (let i = 0; i < ka.length; i++)
        if (ka[i] !== kb[i] || !deepEqual(a[ka[i]], b[ka[i]]))
            return false;

    return true;
}
