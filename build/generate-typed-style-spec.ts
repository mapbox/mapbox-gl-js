import fs from 'fs';
import assert from 'assert';
import spec from '../src/style-spec/reference/latest';
import {supportsPropertyExpression, supportsZoomExpression} from '../src/style-spec/util/properties';

function tag(tag, description = '', indent = '') {
    return [
        '/**',
        ` * ${tag} ${description}`,
        ' */'
    ].map(line => `${indent}${line}`).join('\n');
}

function alias(from, to) {
    const deprecatedTag = tag('@deprecated', `Use \`${to}\` instead.`);
    return [deprecatedTag, `export type ${from} = ${to};`].join('\n');
}

function tsEnum(values) {
    if (Array.isArray(values)) {
        return values.map(v => JSON.stringify(v)).join(' | ');
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return Object.keys(values).map(v => JSON.stringify(v)).join(' | ');
    }
}

function tsType(property, overrideFn?: (any) => string) {
    if (overrideFn) return overrideFn(property);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (typeof property.type === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return property.type();
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const baseType = (() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        switch (property.type) {
        case 'never':
        case 'string':
        case 'number':
        case 'boolean':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            return property.type;
        case 'enum':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            return tsEnum(property.values);
        case 'array':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (property.value === 'light-3d') {
                return 'Array<LightsSpecification>';
            }
            // eslint-disable-next-line no-case-declarations, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const elementType = tsType(typeof property.value === 'string' ? {type: property.value, values: property.values} : property.value, overrideFn);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (property.length) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                return `[${Array(property.length).fill(elementType).join(', ')}]`;
            } else {
                return `Array<${elementType}>`;
            }
        case '$root':
            return 'StyleSpecification';
        case '*':
            return 'unknown';
        default:
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            return `${property.type.split('_').map(part => part.slice(0, 1).toUpperCase() + part.slice(1)).join('')}Specification`;
        }
    })();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (supportsPropertyExpression(property)) {
        return `DataDrivenPropertyValueSpecification<${baseType}>`;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    } else if (supportsZoomExpression(property)) {
        return `PropertyValueSpecification<${baseType}>`;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    } else if (property.expression) {
        return `${baseType} | ExpressionSpecification`;
    } else {
        return baseType;
    }
}

function tsProperty(key, property, overrideFn) {
    assert(property, `Property not found in the style-specification for ${key}`);
    if (key === '*') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return `[_: string]: ${tsType(property, overrideFn)}`;
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
        return `"${key}"${property.required ? '' : '?'}: ${tsType(property, overrideFn)}${property['optional'] ? ' | null | undefined' : ''}`;
    }
}

function tsObjectDeclaration(key, properties, overrides = {}) {
    assert(properties, `Properties not found in the style-specification for ${key}`);

    let experimentalTag;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (properties.experimental) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        delete properties.experimental;
        experimentalTag = tag('@experimental', 'This is experimental and subject to change in future versions.');
    }

    const objectDeclaration = `export type ${key} = ${tsObject(properties, '', overrides)};`;
    return experimentalTag ? [experimentalTag, objectDeclaration].join('\n') : objectDeclaration;
}

function tsObject(properties, indent, overrides = {}) {
    return `{
${// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
Object.keys(properties)
        .flatMap(k => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            let property = `    ${indent}${tsProperty(k, properties[k], overrides[k])}`;

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (properties[k].experimental) {
                const experimentalTag = tag('@experimental', 'This property is experimental and subject to change in future versions.', `    ${indent}`);
                property = [experimentalTag, property].join('\n');
            }

            const result = [property];

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (properties[k].transition) {
                const propertyTransition = `    ${indent}"${k}-transition"?: TransitionSpecification`;
                result.push(propertyTransition);
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (properties[k]['use-theme']) {
                const propertyUseTheme = `    ${indent}"${k}-use-theme"?: PropertyValueSpecification<string>`;
                result.push(propertyUseTheme);
            }

            return result;
        })
        .join(',\n')}
${indent}}`;
}

function tsSourceTypeName(key) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return key.replace(/source_(.)(.*)/, (_, _1, _2) => `${_1.toUpperCase()}${_2}Source`)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .replace(/_dem/, 'DEM')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .replace(/_array/, 'Array')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .replace(/Geojson/, 'GeoJSON');
}

function tsSourceSpecificationTypeName(key) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return tsSourceTypeName(key).concat('Specification');
}

function tsLightTypeName(key) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return key.split('-').map(k => k.replace(/(.)(.*)/, (_, _1, _2) => `${_1.toUpperCase()}${_2}`)).concat('LightSpecification').join('');
}

function tsLayerName(key) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return key.split('-').map(k => k.replace(/(.)(.*)/, (_, _1, _2) => `${_1.toUpperCase()}${_2}`)).join('');
}

function tsLayerTypeName(key) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return tsLayerName(key).concat('Layer');
}

function tsLayerSpecificationTypeName(key) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return tsLayerTypeName(key).concat('Specification');
}

function tsLayer(key) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const layer = structuredClone(spec.layer);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    layer.type = {
        type: 'enum',
        values: [key],
        required: true
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    delete layer.ref;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    delete layer['paint.*'];

    if (spec[`paint_${key}`]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        layer.paint.type = () => {
            return tsObject(spec[`paint_${key}`], '    ');
        };
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        delete layer.paint;
    }

    if (spec[`layout_${key}`]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        layer.layout.type = () => {
            return tsObject(spec[`layout_${key}`], '    ');
        };
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        delete layer.layout;
    }

    if (key === 'background' || key === 'sky' || key === 'slot') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        layer.source = {type: 'never'};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        layer['source-layer'] = {type: 'never'};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        layer.filter = {type: 'never'};
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        layer.source.required = true;
    }

    if (key === 'slot') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        layer.minzoom = {type: 'never'};
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        layer.maxzoom = {type: 'never'};
    }

    if (!spec[`layout_${key}`]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        layer.layout = {type: 'never'};
    }

    if (!spec[`paint_${key}`]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        layer.paint = {type: 'never'};
    }

    const definitions = [
        tsObjectDeclaration(tsLayerSpecificationTypeName(key), layer)
    ];

    if (spec[`layout_${key}`]) {
        definitions.push(alias(`${tsLayerName(key)}Layout`, `${tsLayerSpecificationTypeName(key)}['layout']`));
    }

    if (spec[`paint_${key}`]) {
        definitions.push(alias(`${tsLayerName(key)}Paint`, `${tsLayerSpecificationTypeName(key)}['paint']`));
    }

    return definitions.join('\n\n');
}

function tsLight(key) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const light = spec['light-3d'];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    light.type = {
        type: 'enum',
        values: [key],
        required: true
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    light.properties.type = () => {
        return tsObject(spec[`properties_light_${key}`], '    ');
    };

    return tsObjectDeclaration(tsLightTypeName(key), light);
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
const lightTypes = Object.keys(spec['light-3d'].type.values);

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
const layerTypes = Object.keys(spec.layer.type.values);

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const {source, ...updatableTerrainSpec} = spec.terrain;

fs.writeFileSync('src/style-spec/types.ts', `// Generated code; do not edit. Edit build/generate-typed-style-spec.ts instead.

import type {UnionToIntersection} from './union-to-intersection';

export type ColorSpecification = string;

export type FormattedSpecification = string;

export type ResolvedImageSpecification = string;

export type PromoteIdSpecification = {[_: string]: string | ExpressionSpecification} | string | ExpressionSpecification;

export type FilterSpecification =
    | ExpressionSpecification
    | ['has', string]
    | ['!has', string]
    | ['==', string, string | number | boolean]
    | ['!=', string, string | number | boolean]
    | ['>', string, string | number | boolean]
    | ['>=', string, string | number | boolean]
    | ['<', string, string | number | boolean]
    | ['<=', string, string | number | boolean]
    | Array<string | FilterSpecification>;

export type TransitionSpecification = {
    duration?: number,
    delay?: number
};

// Note: doesn't capture interpolatable vs. non-interpolatable types.

export type PropertyFunctionStop<T> = [number, T];
export type ZoomAndPropertyFunctionStop<T> = [{zoom: number; value: string | number | boolean}, T];

/**
 * @deprecated Use [Expressions](https://docs.mapbox.com/style-spec/reference/expressions/) syntax instead.
*/
export type FunctionSpecification<T> = {
    stops: Array<PropertyFunctionStop<T> | ZoomAndPropertyFunctionStop<T>>;
    base?: number;
    property?: string;
    type?: 'identity' | 'exponential' | 'interval' | 'categorical';
    colorSpace?: 'rgb' | 'lab' | 'hcl';
    default?: T;
};

export type CameraFunctionSpecification<T> =
    | {type: 'exponential', stops: Array<[number, T]>}
    | {type: 'interval',    stops: Array<[number, T]>};

export type SourceFunctionSpecification<T> =
    | {type: 'exponential', stops: Array<[number, T]>, property: string, default?: T}
    | {type: 'interval',    stops: Array<[number, T]>, property: string, default?: T}
    | {type: 'categorical', stops: Array<[string | number | boolean, T]>, property: string, default?: T}
    | {type: 'identity', property: string, default?: T};

export type CompositeFunctionSpecification<T> =
    | {type: 'exponential', stops: Array<[{zoom: number, value: number}, T]>, property: string, default?: T}
    | {type: 'interval',    stops: Array<[{zoom: number, value: number}, T]>, property: string, default?: T}
    | {type: 'categorical', stops: Array<[{zoom: number, value: string | number | boolean}, T]>, property: string, default?: T};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExpressionSpecification = [string, ...any[]];

export type PropertyValueSpecification<T> =
    | T
    | CameraFunctionSpecification<T>
    | ExpressionSpecification;

export type DataDrivenPropertyValueSpecification<T> =
    | T
    | FunctionSpecification<T>
    | CameraFunctionSpecification<T>
    | SourceFunctionSpecification<T>
    | CompositeFunctionSpecification<T>
    | ExpressionSpecification
    | (T extends Array<infer U> ? Array<U | ExpressionSpecification> : never);

${tsObjectDeclaration('StyleSpecification', spec.$root)}

${tsObjectDeclaration('SourcesSpecification', spec.sources)}

${tsObjectDeclaration('ModelsSpecification', spec.models)}

${tsObjectDeclaration('ModelNodeOverrideSpecification', spec.modelNodeOverride)}
${tsObjectDeclaration('ModelNodeOverridesSpecification', spec.modelNodeOverrides)}
${tsObjectDeclaration('ModelMaterialOverrideSpecification', spec.modelMaterialOverride)}
${tsObjectDeclaration('ModelMaterialOverridesSpecification', spec.modelMaterialOverrides)}
${tsObjectDeclaration('ModelSourceModelsSpecification', spec.modelSourceModels)}
${tsObjectDeclaration('ModelSourceModelSpecification', spec.modelSourceModel)}

${tsObjectDeclaration('IconsetsSpecification', spec.iconsets)}

${tsObjectDeclaration('LightSpecification', spec.light)}

${tsObjectDeclaration('TerrainSpecification', spec.terrain)}
${tsObjectDeclaration('TerrainSpecificationUpdate', updatableTerrainSpec)}

${tsObjectDeclaration('FogSpecification', spec.fog)}

${tsObjectDeclaration('SnowSpecification', spec.snow)}

${tsObjectDeclaration('RainSpecification', spec.rain)}

${tsObjectDeclaration('CameraSpecification', spec.camera)}

${tsObjectDeclaration('ColorThemeSpecification', spec.colorTheme)}

${tsObjectDeclaration('ProjectionSpecification', spec.projection)}

${tsObjectDeclaration('ImportSpecification', spec.import)}

${tsObjectDeclaration('IndoorSpecification', spec.indoor)}

${tsObjectDeclaration('IndoorSourceSpecification', spec.indoor_source)}

${tsObjectDeclaration('ConfigSpecification', spec.config)}

${tsObjectDeclaration('SchemaSpecification', spec.schema)}

${tsObjectDeclaration('OptionSpecification', spec.option)}

${tsObjectDeclaration('FeaturesetsSpecification', spec.featuresets)}

${tsObjectDeclaration('FeaturesetSpecification', spec.featureset)}

${tsObjectDeclaration('SelectorSpecification', spec.selector)}

${tsObjectDeclaration('SelectorPropertySpecification', spec.selectorProperty)}

${tsObjectDeclaration('AppearanceSpecification', spec.appearance)}

${// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
spec.source.map(key => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const sourceSpecName = tsSourceSpecificationTypeName(key);
        if (sourceSpecName === 'GeoJSONSourceSpecification') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            return tsObjectDeclaration(sourceSpecName, spec[key], {data: () => 'GeoJSON.GeoJSON | string'});
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return tsObjectDeclaration(sourceSpecName, spec[key]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    }).join('\n\n')}

export type SourceSpecification =
${// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
spec.source.map(key => `    | ${tsSourceSpecificationTypeName(key)}`// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
).join('\n')};

export type IconsetSpecification =
${// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
spec.iconset.map(key => `    | ${// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
tsObject(spec[key], '    ')}`// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
).join('\n')};

export type ModelSpecification = ${tsType(spec.model)};

${lightTypes.map(key => tsLight(key)).join('\n\n')}

export type LightsSpecification =
${lightTypes.map(key => `    | ${tsLightTypeName(key)}`).join('\n')};

${layerTypes.map(key => tsLayer(key)).join('\n\n')}

export type LayerSpecification =
${layerTypes.map(key => `    | ${tsLayerSpecificationTypeName(key)}`).join('\n')};

export type LayoutSpecification = UnionToIntersection<NonNullable<LayerSpecification['layout']>>;

export type PaintSpecification = UnionToIntersection<NonNullable<LayerSpecification['paint']>>;

// Aliases for easier migration from @types/mapbox-gl

export type Layer = Pick<
    LayerSpecification,
    | "id"
    | "type"
    | "source"
    | "source-layer"
    | "slot"
    | "filter"
    | "layout"
    | "paint"
    | "minzoom"
    | "maxzoom"
    | "metadata"
>;

${alias('Style', 'StyleSpecification')}

${alias('AnyLayer', 'LayerSpecification')}

${layerTypes.map(key => alias(tsLayerTypeName(key), tsLayerSpecificationTypeName(key))).join('\n\n')}

${alias('AnyLayout', 'LayoutSpecification')}

${alias('AnyPaint', 'PaintSpecification')}

${alias('Expression', 'ExpressionSpecification')}

${alias('Transition', 'TransitionSpecification')}

${alias('AnySourceData', 'SourceSpecification')}

${alias('Sources', 'SourcesSpecification')}

${alias('Projection', 'ProjectionSpecification')}
`);
