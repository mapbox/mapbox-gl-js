
const removedKeys = new Set(['doc', 'example', 'sdk-support', 'requires', 'units']);

function replacer(k, v) {
    if (typeof v === 'object') {
        const keys = Object.keys(v);
        if (keys.length === 1 && keys[0] === 'doc') return 1; // smaller enums
    }
    if ((k === 'interpolated' || k === 'transition') && v === false) return undefined; // skip these keys with falsy values
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
