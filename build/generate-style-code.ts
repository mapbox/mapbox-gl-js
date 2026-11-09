
import fs from 'fs';
import {compile} from 'yeahjs';
import spec from '../src/style-spec/reference/latest';
import Color from '../src/style-spec/util/color';

import type {StylePropertySpecification} from '../src/style-spec/style-spec';

// A style spec property, annotated by this script with `name` and `type_`; appearance properties also get `src` and `srcSection`.
type SpecProperty = StylePropertySpecification & {
    name: string;
    type_: string;
    src?: string;
    srcSection?: string;
};

// Helpers exposed as globals for the .ejs templates.
declare global {
    var camelize: (str: string) => string;
    var camelizeWithLeadingLowercase: (str: string) => string;
    var flowType: (property: SpecProperty) => string;
    var propertyType: (type: string, property: SpecProperty) => string;
    var runtimeType: (property: SpecProperty) => string;
    var defaultValue: (property: SpecProperty) => string;
    var overrides: (property: SpecProperty) => string;
    var propertyValue: (type: string, property: SpecProperty, valueType?: string) => string;
}

const customTypeBindings: Record<string, string> = {
    "directional.direction": "DirectionProperty",
};

global.camelize = function (str: string) {
    return str.replace(/(?:^|-)(.)/g, (_, x: string) => {
        return x.toUpperCase();
    });
};

global.camelizeWithLeadingLowercase = function (str: string) {
    return str.replace(/-(.)/g, (_, x: string) => {
        return x.toUpperCase();
    });
};

global.flowType = function (property) {
    switch (property.type) {
    case 'boolean':
        return 'boolean';
    case 'number':
        return 'number';
    case 'string':
        return 'string';
    case 'enum':
        return Object.keys(property.values).map((v) => JSON.stringify(v)).join(' | ');
    case 'color':
        return `Color`;
    case 'formatted':
        return `Formatted`;
    case 'resolvedImage':
        return `ResolvedImage${property.name.endsWith('pattern') ? ' | null | undefined' : ''}`;
    case 'array':
        if (property.length) {
            return `[${new Array(property.length).fill(global.flowType({type: property.value} as SpecProperty)).join(', ')}]`;
        } else {
            return `Array<${global.flowType({type: property.value, values: property.values} as SpecProperty)}${property.name === 'line-dasharray' ? ' | null | undefined' : ''}>`;
        }
    default: throw new Error(`unknown type for ${(property as SpecProperty).name}`);
    }
};

global.propertyType = function (type, property) {
    if (customTypeBindings[`${type}.${property.name}`]) {
        return `${customTypeBindings[`${type}.${property.name}`]}`;
    }
    switch (property['property-type']) {
    case 'data-driven':
        return `DataDrivenProperty<${global.flowType(property)}>`;
    case 'color-ramp':
        return `ColorRampProperty`;
    case 'data-constant':
    case 'constant':
        return `DataConstantProperty<${global.flowType(property)}>`;
    default:
        throw new Error(`unknown property-type "${property['property-type']}" for ${property.name}`);
    }
};

global.runtimeType = function (property) {
    switch (property.type) {
    case 'boolean':
        return 'BooleanType';
    case 'number':
        return 'NumberType';
    case 'string':
    case 'enum':
        return 'StringType';
    case 'color':
        return `ColorType`;
    case 'formatted':
        return `FormattedType`;
    case 'array':
        if (property.length) {
            return `array(${global.runtimeType({type: property.value} as SpecProperty)}, ${property.length})`;
        } else {
            return `array(${global.runtimeType({type: property.value} as SpecProperty)})`;
        }
    default: throw new Error(`unknown type for ${property.name}`);
    }
};

global.defaultValue = function (property) {
    switch (property.type) {
    case 'boolean':
    case 'number':
    case 'string':
    case 'array':
    case 'enum':
        return JSON.stringify(property.default);
    case 'color': {
        // The spec type says `string`, but `default` can also be an expression or missing.
        const value: unknown = property.default;
        if (typeof value !== 'string') {
            return JSON.stringify(value);
        } else {
            const {r, g, b, a} = Color.parse(value);
            return `new Color(${r}, ${g}, ${b}, ${a})`;
        }
    }
    default: throw new Error(`unknown type for ${property.name}`);
    }
};

global.overrides = function (property) {
    return `{ runtimeType: ${global.runtimeType(property)}, getOverride: (o: unknown) => (o as Record<string, unknown>).${global.camelizeWithLeadingLowercase(property.name)}, hasOverride: (o: unknown) => !!(o as Record<string, unknown>).${global.camelizeWithLeadingLowercase(property.name)} }`;
};

global.propertyValue = function (type, property, valueType) {
    const valueTypeString = valueType ? `${valueType}_` : "";
    let spec = `styleSpec["${valueTypeString}${property.type_}"]["${property.name}"]`;
    if (property.name.endsWith('-use-theme')) {
        spec = JSON.stringify({
            "type": "string",
            "default": "default",
            "property-type": property['property-type']
        });
    }
    if (customTypeBindings[`${type}.${property.name}`]) {
        return `new ${customTypeBindings[`${type}.${property.name}`]}(${spec})`;
    }
    switch (property['property-type']) {
    case 'data-driven':
        if ('overridable' in property && property.overridable) {
            return `new DataDrivenProperty(${spec}, ${global.overrides(property)})`;
        } else {
            return `new DataDrivenProperty(${spec})`;
        }
    case 'color-ramp':
        return `new ColorRampProperty(${spec})`;
    case 'data-constant':
    case 'constant':
        return `new DataConstantProperty(${spec})`;
    default:
        throw new Error(`unknown property-type "${property['property-type']}" for ${property.name}`);
    }
};

const layerPropertiesJs = compile(fs.readFileSync('src/style/style_layer/layer_properties.js.ejs', 'utf8'));
const layerPropertiesJs3Dstyle = compile(fs.readFileSync('src/style/style_layer/layer_properties.js.ejs', 'utf8'));

const appearanceLayoutProperties: SpecProperty[] = [];
const appearancePaintProperties: SpecProperty[] = [];
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
const layers = Object.keys(spec.layer.type.values).map((type) => {
    const layoutSpec = (spec[`layout_${type}`] ?? {}) as Record<string, SpecProperty>;
    const paintSpec = (spec[`paint_${type}`] ?? {}) as Record<string, SpecProperty>;
    const layoutProperties = Object.keys(layoutSpec).reduce((memo, name) => {
        layoutSpec[name].name = name;
        layoutSpec[name].type_ = type;
        memo.push(layoutSpec[name]);

        if (name === 'icon-image') {
            memo.push({
                'type': 'string',
                'type_': type,
                'default': 'default',
                'property-type': 'data-constant',
                'name': 'icon-image-use-theme'
            });
        }

        if (layoutSpec[name].appearance) {
            appearanceLayoutProperties.push({
                src: `layout_${type}`,
                srcSection: 'layout',
                ...layoutSpec[name]
            });
        }

        return memo;
    }, [] as SpecProperty[]);

    const paintProperties = Object.keys(paintSpec).reduce((memo, name) => {
        paintSpec[name].name = name;
        paintSpec[name].type_ = type;
        memo.push(paintSpec[name]);

        if (paintSpec[name].appearance) {

            appearancePaintProperties.push({
                src: `paint_${type}`,
                srcSection: 'paint',
                ...paintSpec[name]
            });
        }

        return memo;
    }, [] as SpecProperty[]);

    for (const prop of paintProperties) {
        if (prop.type === 'color') {
            paintProperties.push({
                'type': 'string',
                'type_': prop.type_,
                'default': 'default',
                'property-type': 'data-driven',
                'name': `${prop.name}-use-theme`
            });
        }
    }

    return {type, layoutProperties, paintProperties};
});

// Add -use-theme counterparts for color paint appearance properties

for (const prop of [...appearancePaintProperties]) {
    if (prop.type === 'color') {
        appearancePaintProperties.push({
            'type': 'string',
            'type_': prop.type_,
            'default': 'default',
            'property-type': 'data-driven',
            'name': `${prop.name}-use-theme`
        });
    }
}

// Appearances
const appearancePropertiesJs = compile(fs.readFileSync('src/style/appearance_properties.js.ejs', 'utf8'));
fs.writeFileSync(`src/style/appearance_properties.ts`, appearancePropertiesJs({layoutProperties: appearanceLayoutProperties, paintProperties: appearancePaintProperties}));

for (const layer of layers) {
    let srcDir = '../..';
    let styleDir = '..';
    let outputDir = `src/style/style_layer`;
    let properties = layerPropertiesJs;
    if (layer.type === 'model' || layer.type === 'building') {
        srcDir = '../../../src';
        styleDir = '../../../src/style';
        outputDir = `3d-style/style/style_layer`;
        properties = layerPropertiesJs3Dstyle;
    }
    fs.writeFileSync(`${outputDir}/${layer.type.replace('-', '_')}_style_layer_properties.ts`, properties({layer, srcDir, styleDir}));
}

const lightPropertiesJs = compile(fs.readFileSync('3d-style/style/light_properties.js.ejs', 'utf8'));

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
const lights = Object.keys(spec['light-3d'].type.values).map((type) => {
    const lightSpec = spec[`properties_light_${type}`] as Record<string, SpecProperty>;
    const properties = Object.keys(lightSpec).reduce((memo, name) => {
        lightSpec[name].name = name;
        lightSpec[name].type_ = `light_${type}`;
        memo.push(lightSpec[name]);

        if (name === 'color') {
            memo.push({
                'type': 'string',
                'type_': `light_${type}`,
                'default': 'default',
                'property-type': 'data-constant',
                'name': `${name}-use-theme`
            });
        }

        return memo;
    }, [] as SpecProperty[]);

    return {type, properties};
});

for (const light of lights) {
    fs.writeFileSync(`3d-style/style/${light.type}_light_properties.ts`, lightPropertiesJs(light));
}

// Snow
const snowPropertiesJs = compile(fs.readFileSync('3d-style/style/snow_properties.js.ejs', 'utf8'));
const snowSpec = spec[`snow`] as Record<string, SpecProperty>;
const snowProperties = Object.keys(snowSpec).reduce((memo, name) => {
    snowSpec[name].name = name;
    snowSpec[name].type_ = `snow`;
    memo.push(snowSpec[name]);
    return memo;
}, [] as SpecProperty[]);
fs.writeFileSync(`3d-style/style/snow_properties.ts`, snowPropertiesJs(snowProperties));

// Rain
const rainPropertiesJs = compile(fs.readFileSync('3d-style/style/rain_properties.js.ejs', 'utf8'));
const rainSpec = spec[`rain`] as Record<string, SpecProperty>;
const rainProperties = Object.keys(rainSpec).reduce((memo, name) => {
    rainSpec[name].name = name;
    rainSpec[name].type_ = `rain`;
    memo.push(rainSpec[name]);
    return memo;
}, [] as SpecProperty[]);
fs.writeFileSync(`3d-style/style/rain_properties.ts`, rainPropertiesJs(rainProperties));
