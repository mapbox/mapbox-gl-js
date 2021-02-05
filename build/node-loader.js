import flowRemoveTypes from '@mapbox/flow-remove-types';

const glslRe = /\.glsl$/;

export function resolve(specifier, context, defaultResolve) {
    if (glslRe.test(specifier)) {
        const url = new URL(specifier, context.parentURL).href;
        return {url};
    }
    return defaultResolve(specifier, context, defaultResolve);
}

export function getFormat(url, context, defaultGetFormat) {
    if (glslRe.test(url)) {
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
    return defaultTransformSource(source, context, defaultTransformSource);
}
