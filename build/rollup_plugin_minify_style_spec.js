
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

            const spec = JSON.parse(source);

            delete spec['expression_name'];

            return {
                code: `export default JSON.parse('${JSON.stringify(spec, replacer, 0)}');`,
                map: {mappings: ''}
            };
        }
    };
}
