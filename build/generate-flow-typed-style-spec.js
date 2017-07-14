const spec = require('../src/style-spec/reference/v8.json');
const fs = require('fs');

function flowEnum(values) {
    if (Array.isArray(values)) {
        return values.map(JSON.stringify).join(' | ');
    } else {
        return Object.keys(values).map(JSON.stringify).join(' | ');
    }
}

function flowType(property) {
    if (typeof property.type === 'function') {
        return property.type();
    }

    switch (property.type) {
        case 'string':
        case 'number':
        case 'boolean':
            return property.type;
        case 'enum':
            return flowEnum(property.values);
        case 'array':
            const elementType = flowType(typeof property.value === 'string' ? {type: property.value} : property.value)
            if (property.length) {
                return `[${Array(property.length).fill(elementType).join(', ')}]`;
            } else {
                return `Array<${elementType}>`;
            }
        case 'light':
            return 'LightSpecification';
        case 'sources':
            return '{[string]: SourceSpecification}';
        case '*':
            return 'mixed';
        default:
            return `${property.type.slice(0, 1).toUpperCase()}${property.type.slice(1)}Specification`;
    }
}

function flowProperty(key, property) {
    return `"${key}"${property.required ? '' : '?'}: ${flowType(property)}`;
}

function flowObjectDeclaration(key, properties) {
    return `declare type ${key} = ${flowObject(properties, '', '*' in properties ? '' : '|')}`;
}

function flowObject(properties, indent, sealing = '') {
    return `{${sealing}
${Object.keys(properties)
        .filter(k => k !== '*')
        .map(k => `    ${indent}${flowProperty(k, properties[k])}`)
        .join(',\n')}
${indent}${sealing}}`
}

function flowSourceTypeName(key) {
    return key.replace(/source_(.)(.*)/, (_, _1, _2) => `${_1.toUpperCase()}${_2}SourceSpecification`);
}

function flowLayerTypeName(key) {
    return key.split('-').map(k => k.replace(/(.)(.*)/, (_, _1, _2) => `${_1.toUpperCase()}${_2}`)).concat('LayerSpecification').join('');
}

function flowLayer(key) {
    const layer = spec.layer;

    layer.type = {
        type: 'enum',
        values: [key],
        required: true
    };

    delete layer.ref;
    delete layer['paint.*'];

    layer.paint.type = () => {
        return flowObject(spec[`layout_${key}`], '    ', '|');
    };

    layer.layout.type = () => {
        return flowObject(spec[`paint_${key}`], '    ', '|');
    };

    if (key === 'background') {
        delete layer.source;
        delete layer['source-layer'];
        delete layer.filter;
    } else {
        layer.source.required = true;
    }

    return flowObjectDeclaration(flowLayerTypeName(key), layer);
}

const layerTypes = Object.keys(spec.layer.type.values);

fs.writeFileSync('flow-typed/style-spec.js', `// Generated code; do not edit. Edit build/generate-flow-typed-style-spec.js instead.

declare type ColorSpecification = string;
declare type FilterSpecification = Array<any>;

${flowObjectDeclaration('StyleSpecification', spec.$root)}

${flowObjectDeclaration('LightSpecification', spec.light)}

${spec.source.map(key => flowObjectDeclaration(flowSourceTypeName(key), spec[key])).join('\n\n')}

declare type SourceSpecification =
${spec.source.map(key => `    | ${flowSourceTypeName(key)}`).join('\n')}

${layerTypes.map(key => flowLayer(key)).join('\n\n')}

declare type LayerSpecification =
${layerTypes.map(key => `    | ${flowLayerTypeName(key)}`).join('\n')};

`);
