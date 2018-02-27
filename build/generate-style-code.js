'use strict';

const fs = require('fs');

const ejs = require('ejs');
const spec = require('../src/style-spec/reference/v8');
const Color = require('../src/style-spec/util/color');

global.camelize = function (str) {
    return str.replace(/(?:^|-)(.)/g, function (_, x) {
        return x.toUpperCase();
    });
};

global.isDataDriven = function (property) {
    return property['property-function'] === true;
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
            return Object.keys(property.values).map(JSON.stringify).join(' | ');
        case 'color':
            return `Color`;
        case 'array':
            if (property.length) {
                return `[${new Array(property.length).fill(flowType({type: property.value})).join(', ')}]`;
            } else {
                return `Array<${flowType({type: property.value})}>`;
            }
        default: throw new Error(`unknown type for ${property.name}`)
    }
};

global.propertyType = function (property) {
    if (isDataDriven(property)) {
        return `DataDrivenProperty<${flowType(property)}>`;
    } else if (/-pattern$/.test(property.name) || property.name === 'line-dasharray') {
        return `CrossFadedProperty<${flowType(property)}>`;
    } else if (property.name === 'heatmap-color') {
        return `HeatmapColorProperty`;
    } else {
        return `DataConstantProperty<${flowType(property)}>`;
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
        case 'array':
            if (property.length) {
                return `array(${runtimeType({type: property.value})}, ${property.length})`;
            } else {
                return `array(${runtimeType({type: property.value})})`;
            }
        default: throw new Error(`unknown type for ${property.name}`)
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
                const {r, g, b, a} = Color.parse(property.default);
                return `new Color(${r}, ${g}, ${b}, ${a})`;
            }
        default: throw new Error(`unknown type for ${property.name}`)
    }
};

global.propertyValue = function (property, type) {
    if (isDataDriven(property)) {
        return `new DataDrivenProperty(styleSpec["${type}_${property.layerType}"]["${property.name}"])`;
    } else if (/-pattern$/.test(property.name) || property.name === 'line-dasharray') {
        return `new CrossFadedProperty(styleSpec["${type}_${property.layerType}"]["${property.name}"])`;
    } else if (property.name === 'heatmap-color') {
        return `new HeatmapColorProperty(styleSpec["${type}_${property.layerType}"]["${property.name}"])`;
    } else {
        return `new DataConstantProperty(styleSpec["${type}_${property.layerType}"]["${property.name}"])`;
    }
};

const propertiesJs = ejs.compile(fs.readFileSync('src/style/style_layer/layer_properties.js.ejs', 'utf8'), {strict: true});

const layers = Object.keys(spec.layer.type.values).map((type) => {
    const layoutProperties = Object.keys(spec[`layout_${type}`]).reduce((memo, name) => {
        if (name !== 'visibility') {
            spec[`layout_${type}`][name].name = name;
            spec[`layout_${type}`][name].layerType = type;
            memo.push(spec[`layout_${type}`][name]);
        }
        return memo;
    }, []);

    const paintProperties = Object.keys(spec[`paint_${type}`]).reduce((memo, name) => {
        spec[`paint_${type}`][name].name = name;
        spec[`paint_${type}`][name].layerType = type;
        memo.push(spec[`paint_${type}`][name]);
        return memo;
    }, []);

    return { type, layoutProperties, paintProperties };
});

for (const layer of layers) {
    fs.writeFileSync(`src/style/style_layer/${layer.type.replace('-', '_')}_style_layer_properties.js`, propertiesJs(layer))
}

