
const removedKeys = new Set(['$doc', 'doc', 'example', 'sdk-support', 'requires', 'units', 'experimental', 'private', 'required']);

function replacer(k, v) {
    if (typeof v === 'object') {
        const keys = Object.keys(v);
        if (keys.length === 1 && keys[0] === 'doc') return 1; // smaller enums
    }
    if (k === 'property-type' && v !== 'data-driven') return undefined;
    if (k === 'expression' && Object.keys(v).length === 0) return undefined;
    if ((k === 'interpolated' || k === 'transition' || k === 'use-theme') && v === false) return undefined; // skip these keys with falsy values
    return removedKeys.has(k) ? undefined : v;
}

export default function minifyStyleSpec() {
    return {
        name: 'minify-style-spec',
        transform: (source, id) => {
            if (!/style\-spec[\\/]reference[\\/]v[0-9]+\.json$/.test(id)) {
                return;
            }

            const spec = JSON.parse(source);

            delete spec['expression_name'];

            return {
                code: `export default JSON.parse('${JSON.stringify(spec, replacer, 0)}');`,
                map: {mappings: ''}
            };
        }
    };
}
