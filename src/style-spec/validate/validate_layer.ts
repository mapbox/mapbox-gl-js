import ValidationError from '../error/validation_error';
import {unbundle} from '../util/unbundle_jsonlint';
import validateObject from './validate_object';
import validateFilter from './validate_filter';
import validatePaintProperty from './validate_paint_property';
import validateLayoutProperty from './validate_layout_property';
import validateSpec from './validate';
import extend from '../util/extend';
import {isObject, isString} from '../util/get_type';

import type {StyleReference} from '../reference/latest';
import type {StyleSpecification, LayerSpecification, GeoJSONSourceSpecification} from '../types';

type LayerValidatorOptions = {
    key: string;
    value: unknown;
    style: Partial<StyleSpecification>;
    styleSpec: StyleReference;
    arrayIndex: number;
};

export default function validateLayer(options: LayerValidatorOptions): ValidationError[] {
    let errors: ValidationError[] = [];

    const layer = options.value;
    const key = options.key;
    const style = options.style;
    const styleSpec = options.styleSpec;

    if (!isObject(layer)) {
        return [new ValidationError(key, layer, `object expected`)];
    }

    if (!layer.type && !layer.ref) {
        errors.push(new ValidationError(key, layer, 'either "type" or "ref" is required'));
    }

    let type = unbundle(layer.type) as string;
    const ref = unbundle(layer.ref);

    if (layer.id) {
        const layerId = unbundle(layer.id) as string;
        for (let i = 0; i < options.arrayIndex; i++) {
            const otherLayer = style.layers[i];
            if (unbundle(otherLayer.id) === layerId) {
                errors.push(new ValidationError(key, layer.id, `duplicate layer id "${layerId}", previously used at line ${(otherLayer.id as {__line__?: number}).__line__}`));
            }
        }
    }

    if ('ref' in layer) {
        ['type', 'source', 'source-layer', 'filter', 'layout'].forEach((p) => {
            if (p in layer) {
                errors.push(new ValidationError(key, layer[p], `"${p}" is prohibited for ref layers`));
            }
        });

        let parent;

        style.layers.forEach((layer) => {
            if (unbundle(layer.id) === ref) parent = layer;
        });

        if (!parent) {
            if (typeof ref === 'string')
                errors.push(new ValidationError(key, layer.ref, `ref layer "${ref}" not found`));
        } else if (parent.ref) {
            errors.push(new ValidationError(key, layer.ref, 'ref cannot reference another ref layer'));
        } else {
            type = unbundle(parent.type) as string;
        }
    } else if (!(type === 'background' || type === 'sky' || type === 'slot')) {
        if (!layer.source) {
            errors.push(new ValidationError(key, layer, 'missing required property "source"'));
        } else if (!isString(layer.source)) {
            errors.push(new ValidationError(`${key}.source`, layer.source, '"source" must be a string'));
        } else {
            const source = style.sources && style.sources[layer.source];
            const sourceType = source && unbundle(source.type);
            if (!source) {
                errors.push(new ValidationError(key, layer.source, `source "${layer.source}" not found`));
            } else if (sourceType === 'vector' && type === 'raster') {
                errors.push(new ValidationError(key, layer.source, `layer "${layer.id as string}" requires a raster source`));
            } else if (sourceType === 'raster' && type !== 'raster') {
                errors.push(new ValidationError(key, layer.source, `layer "${layer.id as string}" requires a vector source`));
            } else if (sourceType === 'vector' && !layer['source-layer']) {
                errors.push(new ValidationError(key, layer, `layer "${layer.id as string}" must specify a "source-layer"`));
            } else if (sourceType === 'raster-dem' && type !== 'hillshade') {
                errors.push(new ValidationError(key, layer.source, 'raster-dem source can only be used with layer type \'hillshade\'.'));
            } else if (sourceType === 'raster-array' && !['raster', 'raster-particle'].includes(type)) {
                errors.push(new ValidationError(key, layer.source, `raster-array source can only be used with layer type \'raster\'.`));
            } else if (type === 'line' && layer.paint && (layer.paint['line-gradient'] || layer.paint['line-trim-offset']) &&
                    (sourceType === 'geojson' && !(source as GeoJSONSourceSpecification).lineMetrics)) {
                errors.push(new ValidationError(key, layer, `layer "${layer.id as string}" specifies a line-gradient, which requires the GeoJSON source to have \`lineMetrics\` enabled.`));
            } else if (type === 'raster-particle' && sourceType !== 'raster-array') {
                errors.push(new ValidationError(key, layer.source, `layer "${layer.id as string}" requires a \'raster-array\' source.`));
            }
        }
    }

    errors = errors.concat(validateObject({
        key,
        value: layer,
        valueSpec: styleSpec.layer,
        style: options.style,
        styleSpec: options.styleSpec,
        objectElementValidators: {
            '*'() {
                return [];
            },
            // We don't want to enforce the spec's `"requires": true` for backward compatibility with refs;
            // the actual requirement is validated above. See https://github.com/mapbox/mapbox-gl-js/issues/5772.
            type() {
                return validateSpec({
                    key: `${key}.type`,
                    value: layer.type,
                    valueSpec: styleSpec.layer.type,
                    style: options.style,
                    styleSpec: options.styleSpec,
                    object: layer,
                    objectKey: 'type'
                });
            },
            filter(options) {
                return validateFilter(extend({layerType: type}, options));
            },
            layout(options) {
                return validateObject({
                    layer: layer as LayerSpecification,
                    key: options.key,
                    value: options.value,
                    valueSpec: {},
                    style: options.style,
                    styleSpec: options.styleSpec,
                    objectElementValidators: {
                        '*'(options) {
                            return validateLayoutProperty(extend({layerType: type}, options));
                        }
                    }
                });
            },
            paint(options) {
                return validateObject({
                    layer: layer as LayerSpecification,
                    key: options.key,
                    value: options.value,
                    valueSpec: {},
                    style: options.style,
                    styleSpec: options.styleSpec,
                    objectElementValidators: {
                        '*'(options) {
                            return validatePaintProperty(extend({layerType: type, layer}, options));
                        }
                    }
                });
            }
        }
    }));

    return errors;
}
