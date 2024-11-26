'use strict';

import fs from 'fs';
import ejs from 'ejs';
import spec from '../src/style-spec/reference/latest';
import Color from '../src/style-spec/util/color';

const customTypeBindings = {
    "directional.direction": "DirectionProperty",
};

global.camelize = function (str) {
    return str.replace(/(?:^|-)(.)/g, (_, x) => {
        return x.toUpperCase();
    });
};

global.camelizeWithLeadingLowercase = function (str) {
    return str.replace(/-(.)/g, (_, x) => {
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
            return `[${new Array(property.length).fill(global.flowType({type: property.value})).join(', ')}]`;
        } else {
            return `Array<${global.flowType({type: property.value, values: property.values})}${property.name === 'line-dasharray' ? ' | null | undefined' : ''}>`;
        }
    default: throw new Error(`unknown type for ${property.name}`);
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
    case 'Image':
        return `ImageType`;
    case 'array':
        if (property.length) {
            return `array(${global.runtimeType({type: property.value})}, ${property.length})`;
        } else {
            return `array(${global.runtimeType({type: property.value})})`;
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
    case 'color':
        if (typeof property.default !== 'string') {
            return JSON.stringify(property.default);
        } else {
            const {r, g, b, a} = Color.parse(property.default) as Color;
            return `new Color(${r}, ${g}, ${b}, ${a})`;
        }
    default: throw new Error(`unknown type for ${property.name}`);
    }
};

global.overrides = function (property) {
    return `{ runtimeType: ${global.runtimeType(property)}, getOverride: (o) => o.${global.camelizeWithLeadingLowercase(property.name)}, hasOverride: (o) => !!o.${global.camelizeWithLeadingLowercase(property.name)} }`;
};

global.propertyValue = function (type, property, valueType) {
    const spec = `styleSpec["${valueType}_${property.type_}"]["${property.name}"]`;
    if (customTypeBindings[`${type}.${property.name}`]) {
        return `new ${customTypeBindings[`${type}.${property.name}`]}(${spec})`;
    }
    switch (property['property-type']) {
    case 'data-driven':
        if (property.overridable) {
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

const layerPropertiesJs = ejs.compile(fs.readFileSync('src/style/style_layer/layer_properties.js.ejs', 'utf8'), {strict: true});
const layerPropertiesJs3Dstyle = ejs.compile(fs.readFileSync('src/style/style_layer/layer_properties.js.ejs', 'utf8'), {strict: true});

const layers = Object.keys(spec.layer.type.values).map((type) => {
    const layoutSpec = spec[`layout_${type}`] ?? {};
    const paintSpec = spec[`paint_${type}`] ?? {};
    const layoutProperties = Object.keys(layoutSpec).reduce<Array<any>>((memo, name) => {
        layoutSpec[name].name = name;
        layoutSpec[name].type_ = type;
        memo.push(layoutSpec[name]);
        return memo;
    }, []);

    const paintProperties = Object.keys(paintSpec).reduce<Array<any>>((memo, name) => {
        paintSpec[name].name = name;
        paintSpec[name].type_ = type;
        memo.push(paintSpec[name]);
        return memo;
    }, []);

    return {type, layoutProperties, paintProperties};
});

for (const layer of layers) {
    let srcDir = '../..';
    let styleDir = '..';
    let outputDir = `src/style/style_layer`;
    let properties = layerPropertiesJs;
    if (layer.type === 'model') {
        srcDir = '../../../src';
        styleDir = '../../../src/style';
        outputDir = `3d-style/style/style_layer`;
        properties = layerPropertiesJs3Dstyle;
    }
    fs.writeFileSync(`${outputDir}/${layer.type.replace('-', '_')}_style_layer_properties.ts`, properties({layer, srcDir, styleDir}));
}

const lightPropertiesJs = ejs.compile(fs.readFileSync('3d-style/style/light_properties.js.ejs', 'utf8'), {strict: true});

const lights = Object.keys(spec['light-3d'].type.values).map((type) => {
    const properties = Object.keys(spec[`properties_light_${type}`]).reduce<Array<any>>((memo, name) => {
        spec[`properties_light_${type}`][name].name = name;
        spec[`properties_light_${type}`][name].type_ = `light_${type}`;
        memo.push(spec[`properties_light_${type}`][name]);
        return memo;
    }, []);

    return {type, properties};
});

for (const light of lights) {
    fs.writeFileSync(`3d-style/style/${light.type}_light_properties.ts`, lightPropertiesJs(light));
}
