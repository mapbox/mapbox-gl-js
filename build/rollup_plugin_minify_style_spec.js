
function replacer(k, v) {
    if (k === 'values') Object.keys(v).reduce((obj, key) => (obj[key] = true, obj), {});
    return k === 'doc' || k === 'example' || k === 'sdk-support' || k === 'requires' ? undefined : v;
}

export default function minifyStyleSpec() {
    return {
        name: 'minify-style-spec',
        transform: (source, id) => {
            if (!/style\-spec[\\/]reference[\\/]v[0-9]+\.json$/.test(id)) {
                return;
            }

            return {
                code: JSON.stringify(JSON.parse(source), replacer, 0),
                map: {mappings: ''}
            };
        }
    };
}
