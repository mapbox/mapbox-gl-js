// Rollup plugin that shrinks the style spec (`v8.json`) before it's bundled. The validator and
// runtime read only a subset of each property's metadata, so we strip the rest and normalize the
// shapes that remain — losslessly with respect to everything the code actually consumes.

// Pure documentation/metadata that nothing reads at runtime.
const droppedKeys = new Set(['$doc', 'doc', 'example', 'sdk-support', 'requires', 'units', 'experimental', 'private', 'required', 'period', 'supported-layer-types']);

// Flags the code only ever truthy-checks, never reads as a strict boolean — so `true` becomes the
// 1-byte `1`, and `false` is dropped entirely (absence reads the same as falsy).
const flagKeys = new Set(['transition', 'interpolated', 'use-theme', 'relaxZoomRestriction', 'appearance', 'tokens', 'overridable']);

// Canonical order for known metadata keys. Emitting every property's keys in the same order makes
// the many near-identical shapes byte-identical, which compresses better. Unknown keys (property
// names, enum values, layer fields) sort after these, keeping their original relative order.
const keyOrder = ['type', 'default', 'minimum', 'maximum', 'length', 'value', 'values', 'units', 'expression', 'interpolated', 'parameters', 'relaxZoomRestriction', 'transition', 'use-theme', 'property-type', 'appearance', 'overridable', 'tokens', 'function'];
const keyRank = new Map(keyOrder.map((k, i) => [k, i]));
function rankOf(k) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return keyRank.has(k) ? keyRank.get(k) : keyOrder.length;
}

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
function minify(value) {
    if (Array.isArray(value)) return value.map(minify);
    if (!value || typeof value !== 'object') return value;

    // An object holding only a `doc` collapses to `1` (e.g. enum value descriptions).
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === 'doc') return 1;

    const result = {};
    for (const k of keys.sort((a, b) => rankOf(a) - rankOf(b))) {
        let v = value[k];

        if (droppedKeys.has(k)) continue;
        if (k === 'property-type' && v !== 'data-driven') continue; // only data-driven is read
        if (flagKeys.has(k) && v === false) continue;

        if (k === 'expression' && !v.parameters && !v.interpolated && !v.relaxZoomRestriction) {
            // A contentless expression still marks the property expression-capable. Consumers only
            // truthy-check it or read `.parameters`/`.interpolated` (both safely `undefined` on a
            // number), so `1` preserves behavior while saving bytes.
            v = 1;
        } else if (k === 'parameters' && Array.isArray(v)) {
            v = [...v].sort(); // expression parameter order is irrelevant to consumers
        } else {
            v = minify(v);
            if (v === true && flagKeys.has(k)) v = 1;
        }

        result[k] = v;
    }
    return result;
}
/* eslint-enable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

export default function minifyStyleSpec() {
    return {
        name: 'minify-style-spec',
        transform: (source, id) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            if (!/style\-spec[\\/]reference[\\/]v[0-9]+\.json$/.test(id)) {
                return;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
            const spec = JSON.parse(source);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            delete spec['expression_name'];

            return {
                code: `export default JSON.parse('${JSON.stringify(minify(spec))}');`,
                map: null
            };
        }
    };
}
