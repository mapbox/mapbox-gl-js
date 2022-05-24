// @flow

import ValidationError from '../error/validation_error.js';
import {unbundle} from '../util/unbundle_jsonlint.js';
import validateObject from './validate_object.js';
import validateFilter from './validate_filter.js';
import validatePaintProperty from './validate_paint_property.js';
import validateLayoutProperty from './validate_layout_property.js';
import validateSpec from './validate.js';
import extend from '../util/extend.js';

import type {ValidationOptions} from './validate.js';
import type {LayerSpecification} from '../types.js';

type Options = ValidationOptions & {
    value: LayerSpecification;
    arrayIndex: number;
}

export default function validateLayer(options: Options): Array<ValidationError> {
    let errors = [];

    const layer = options.value;
    const key = options.key;
    const style = options.style;
    const styleSpec = options.styleSpec;

    if (!layer.type && !layer.ref) {
        errors.push(new ValidationError(key, layer, 'either "type" or "ref" is required'));
    }
    let type = unbundle(layer.type);
    const ref = unbundle(layer.ref);

    if (layer.id) {
        const layerId = unbundle(layer.id);
        for (let i = 0; i < options.arrayIndex; i++) {
            const otherLayer = style.layers[i];
            if (unbundle(otherLayer.id) === layerId) {
                // $FlowFixMe[prop-missing] - id.__line__ is added dynamically during the readStyle step
                errors.push(new ValidationError(key, layer.id, `duplicate layer id "${layer.id}", previously used at line ${otherLayer.id.__line__}`));
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
            type = unbundle(parent.type);
        }
    } else if (!(type === 'background' || type === 'sky')) {
        if (!layer.source) {
            errors.push(new ValidationError(key, layer, 'missing required property "source"'));
        } else {
            const source = style.sources && style.sources[layer.source];
            const sourceType = source && unbundle(source.type);
            if (!source) {
                errors.push(new ValidationError(key, layer.source, `source "${layer.source}" not found`));
            } else if (sourceType === 'vector' && type === 'raster') {
                errors.push(new ValidationError(key, layer.source, `layer "${layer.id}" requires a raster source`));
            } else if (sourceType === 'raster' && type !== 'raster') {
                errors.push(new ValidationError(key, layer.source, `layer "${layer.id}" requires a vector source`));
            } else if (sourceType === 'vector' && !layer['source-layer']) {
                errors.push(new ValidationError(key, layer, `layer "${layer.id}" must specify a "source-layer"`));
            } else if (sourceType === 'raster-dem' && type !== 'hillshade') {
                errors.push(new ValidationError(key, layer.source, 'raster-dem source can only be used with layer type \'hillshade\'.'));
            } else if (type === 'line' && layer.paint && (layer.paint['line-gradient'] || layer.paint['line-trim-offset']) &&
                       (sourceType !== 'geojson' || !source.lineMetrics)) {
                errors.push(new ValidationError(key, layer, `layer "${layer.id}" specifies a line-gradient, which requires a GeoJSON source with \`lineMetrics\` enabled.`));
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
                    layer,
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
                    layer,
                    key: options.key,
                    value: options.value,
                    valueSpec: {},
                    style: options.style,
                    styleSpec: options.styleSpec,
                    objectElementValidators: {
                        '*'(options) {
                            return validatePaintProperty(extend({layerType: type}, options));
                        }
                    }
                });
            }
        }
    }));

    return errors;
}
