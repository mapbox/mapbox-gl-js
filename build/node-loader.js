import flowRemoveTypes from '@mapbox/flow-remove-types';
import {dataToEsm} from '@rollup/pluginutils';

const glslRe = /\.glsl$/;
const jsonRe = /\.json$/;

export async function resolve(specifier, context, nextResolve) {
    if (glslRe.test(specifier)) {
        const url = new URL(specifier, context.parentURL).href;
        return {url, shortCircuit: true};
    }

    if (specifier == 'tracked_parameters_proxy') {
        specifier = './internal/tracked_parameters_mock.js';
    }

    return nextResolve(specifier);
}

export async function load(url, context, nextLoad) {
    if (context.format === 'module') {
        const {source: rawSource} = await nextLoad(url, context);
        const source = rawSource.toString();
        if (source.indexOf('@flow') >= 0) {
            const transformedSource = flowRemoveTypes(source).toString();
            return {format: 'module', source: transformedSource, shortCircuit: true};
        }
    }

    if (glslRe.test(url)) {
        const {source: rawSource} = await nextLoad(url, {...context, format: 'module'});
        const source = `export default \`${rawSource.toString()}\``;
        return {format: 'module', source, shortCircuit: true};
    }

    if (jsonRe.test(url)) {
        const {source: rawSource} = await nextLoad(url, {...context,
            // Force import assertions as "assert { type: 'json' }"
            importAssertions: {type: 'json'}
        });

        const source = dataToEsm(JSON.parse(rawSource.toString()), {
            preferConst: true,
            namedExports: true,
            indent: '    '
        });

        return {format: 'module', source, shortCircuit: true};
    }

    return nextLoad(url);
}
