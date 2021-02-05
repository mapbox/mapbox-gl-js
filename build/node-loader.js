import flowRemoveTypes from '@mapbox/flow-remove-types';
import {dataToEsm} from '@rollup/pluginutils';

const glslRe = /\.glsl$/;
const jsonRe = /\.json$/;

export function resolve(specifier, context, defaultResolve) {
    if (glslRe.test(specifier)) {
        const url = new URL(specifier, context.parentURL).href;
        return {url};
    }
    return defaultResolve(specifier, context, defaultResolve);
}

export function getFormat(url, context, defaultGetFormat) {
    if (glslRe.test(url) || jsonRe.test(url)) {
        return {format: 'module'};
    }
    return defaultGetFormat(url, context, defaultGetFormat);
}

export function transformSource(source, context, defaultTransformSource) {
    if (source.indexOf('@flow') >= 0) {
        source = flowRemoveTypes(source.toString()).toString();
        return {source};
    }
    if (glslRe.test(context.url)) {
        return {source: `export default \`${source}\``};
    }
    if (jsonRe.test(context.url)) {
        source = dataToEsm(JSON.parse(source), {
            preferConst: true,
            namedExports: true,
            indent: '    '
        });
        return {source};
    }
    return defaultTransformSource(source, context, defaultTransformSource);
}
