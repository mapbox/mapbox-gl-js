
import fs from 'fs';
import ejs from 'ejs';
import spec from '../src/style-spec/reference/latest';
import Color from '../src/style-spec/util/color';

const customTypeBindings = {
    "directional.direction": "DirectionProperty",
};

global.camelize = function (str) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return str.replace(/(?:^|-)(.)/g, (_, x) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return x.toUpperCase();
    });
};

global.camelizeWithLeadingLowercase = function (str) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return str.replace(/-(.)/g, (_, x) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return x.toUpperCase();
    });
};

global.flowType = function (property) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    switch (property.type) {
    case 'boolean':
        return 'boolean';
    case 'number':
        return 'number';
    case 'string':
        return 'string';
    case 'enum':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        return Object.keys(property.values).map((v) => JSON.stringify(v)).join(' | ');
    case 'color':
        return `Color`;
    case 'formatted':
        return `Formatted`;
    case 'resolvedImage':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return `ResolvedImage${property.name.endsWith('pattern') ? ' | null | undefined' : ''}`;
    case 'array':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (property.length) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
            return `[${new Array(property.length).fill(global.flowType({type: property.value})).join(', ')}]`;
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            return `Array<${global.flowType({type: property.value, values: property.values})}${property.name === 'line-dasharray' ? ' | null | undefined' : ''}>`;
        }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    default: throw new Error(`unknown type for ${property.name}`);
    }
};

global.propertyType = function (type, property) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (customTypeBindings[`${type}.${property.name}`]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return `${customTypeBindings[`${type}.${property.name}`]}`;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    switch (property['property-type']) {
    case 'data-driven':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return `DataDrivenProperty<${global.flowType(property)}>`;
    case 'color-ramp':
        return `ColorRampProperty`;
    case 'data-constant':
    case 'constant':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return `DataConstantProperty<${global.flowType(property)}>`;
    default:
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(`unknown property-type "${property['property-type']}" for ${property.name}`);
    }
};

global.runtimeType = function (property) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (property.length) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            return `array(${global.runtimeType({type: property.value})}, ${property.length})`;
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            return `array(${global.runtimeType({type: property.value})})`;
        }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    default: throw new Error(`unknown type for ${property.name}`);
    }
};

global.defaultValue = function (property) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    switch (property.type) {
    case 'boolean':
    case 'number':
    case 'string':
    case 'array':
    case 'enum':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return JSON.stringify(property.default);
    case 'color':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (typeof property.default !== 'string') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            return JSON.stringify(property.default);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            const {r, g, b, a} = Color.parse(property.default);
            return `new Color(${r}, ${g}, ${b}, ${a})`;
        }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    default: throw new Error(`unknown type for ${property.name}`);
    }
};

global.overrides = function (property) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return `{ runtimeType: ${global.runtimeType(property)}, getOverride: (o: Record<string, unknown>) => o.${global.camelizeWithLeadingLowercase(property.name)}, hasOverride: (o: Record<string, unknown>) => !!o.${global.camelizeWithLeadingLowercase(property.name)} }`;
};

global.propertyValue = function (type, property, valueType) {
    const valueTypeString = valueType ? `${valueType}_` : "";
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    let spec = `styleSpec["${valueTypeString}${property.type_}"]["${property.name}"]`;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    if (property.name.endsWith('-use-theme')) {
        spec = JSON.stringify({
            "type": "string",
            "default": "default",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            "property-type": property['property-type']
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (customTypeBindings[`${type}.${property.name}`]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return `new ${customTypeBindings[`${type}.${property.name}`]}(${spec})`;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    switch (property['property-type']) {
    case 'data-driven':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (property.overridable) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(`unknown property-type "${property['property-type']}" for ${property.name}`);
    }
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
const layerPropertiesJs = ejs.compile(fs.readFileSync('src/style/style_layer/layer_properties.js.ejs', 'utf8'), {strict: true});
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
const layerPropertiesJs3Dstyle = ejs.compile(fs.readFileSync('src/style/style_layer/layer_properties.js.ejs', 'utf8'), {strict: true});

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
const layers = Object.keys(spec.layer.type.values).map((type) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const layoutSpec = spec[`layout_${type}`] ?? {};
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const paintSpec = spec[`paint_${type}`] ?? {};
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const layoutProperties = Object.keys(layoutSpec).reduce((memo, name) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        layoutSpec[name].name = name;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        layoutSpec[name].type_ = type;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

        return memo;
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const paintProperties = Object.keys(paintSpec).reduce((memo, name) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        paintSpec[name].name = name;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        paintSpec[name].type_ = type;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        memo.push(paintSpec[name]);
        return memo;
    }, []);

    for (const prop of paintProperties) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (prop.type === 'color') {
            paintProperties.push({
                'type': 'string',
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                'type_': prop.type_,
                'default': 'default',
                'property-type': 'data-driven',
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                'name': `${prop.name}-use-theme`
            });
        }
    }

    return {type, layoutProperties, paintProperties};
});

for (const layer of layers) {
    let srcDir = '../..';
    let styleDir = '..';
    let outputDir = `src/style/style_layer`;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    let properties = layerPropertiesJs;
    if (layer.type === 'model' || layer.type === 'building') {
        srcDir = '../../../src';
        styleDir = '../../../src/style';
        outputDir = `3d-style/style/style_layer`;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        properties = layerPropertiesJs3Dstyle;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
    fs.writeFileSync(`${outputDir}/${layer.type.replace('-', '_')}_style_layer_properties.ts`, properties({layer, srcDir, styleDir}));
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
const lightPropertiesJs = ejs.compile(fs.readFileSync('3d-style/style/light_properties.js.ejs', 'utf8'), {strict: true});

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
const lights = Object.keys(spec['light-3d'].type.values).map((type) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const properties = Object.keys(spec[`properties_light_${type}`]).reduce((memo, name) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        spec[`properties_light_${type}`][name].name = name;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        spec[`properties_light_${type}`][name].type_ = `light_${type}`;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        memo.push(spec[`properties_light_${type}`][name]);

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
    }, []);

    return {type, properties};
});

for (const light of lights) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
    fs.writeFileSync(`3d-style/style/${light.type}_light_properties.ts`, lightPropertiesJs(light));
}

// Snow
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
const snowPropertiesJs = ejs.compile(fs.readFileSync('3d-style/style/snow_properties.js.ejs', 'utf8'), {strict: true});
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const snowProperties = Object.keys(spec[`snow`]).reduce((memo, name) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    spec[`snow`][name].name = name;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    spec[`snow`][name].type_ = `snow`;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    memo.push(spec[`snow`][name]);
    return memo;
}, []);
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
fs.writeFileSync(`3d-style/style/snow_properties.ts`, snowPropertiesJs(snowProperties));

// Rain
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
const rainPropertiesJs = ejs.compile(fs.readFileSync('3d-style/style/rain_properties.js.ejs', 'utf8'), {strict: true});
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const rainProperties = Object.keys(spec[`rain`]).reduce((memo, name) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    spec[`rain`][name].name = name;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    spec[`rain`][name].type_ = `rain`;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    memo.push(spec[`rain`][name]);
    return memo;
}, []);
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
fs.writeFileSync(`3d-style/style/rain_properties.ts`, rainPropertiesJs(rainProperties));
