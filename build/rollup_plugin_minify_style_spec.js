
function replacer(k, v) {
    return (k === 'doc' || k === 'example' || k === 'sdk-support') ? undefined : v;
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
