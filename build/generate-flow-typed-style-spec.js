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

    const baseType = (() => {
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
    })();

    if (property['property-function']) {
        return `DataDrivenPropertyValueSpecification<${baseType}>`;
    } else if (property['zoom-function']) {
        return `PropertyValueSpecification<${baseType}>`;
    } else {
        return baseType;
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
        return flowObject(spec[`paint_${key}`], '    ', '|');
    };

    layer.layout.type = () => {
        return flowObject(spec[`layout_${key}`], '    ', '|');
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

declare type FilterSpecification =
    | ['has', string]
    | ['!has', string]
    | ['==', string, string | number | boolean]
    | ['!=', string, string | number | boolean]
    | ['>', string, string | number | boolean]
    | ['>=', string, string | number | boolean]
    | ['<', string, string | number | boolean]
    | ['<=', string, string | number | boolean]
    | Array<string | FilterSpecification>; // Can't type in, !in, all, any, none -- https://github.com/facebook/flow/issues/2443

declare type TransitionSpecification = {
    duration?: number,
    delay?: number
};

// Note: doesn't capture interpolatable vs. non-interpolatable types.

declare type CameraFunctionSpecification<T> =
    | {| type: 'exponential', stops: Array<[number, T]> |}
    | {| type: 'interval',    stops: Array<[number, T]> |};

declare type SourceFunctionSpecification<T> =
    | {| type: 'exponential', stops: Array<[number, T]>, property: string, default?: T |}
    | {| type: 'interval',    stops: Array<[number, T]>, property: string, default?: T |}
    | {| type: 'categorical', stops: Array<[string | number | boolean, T]>, property: string, default?: T |}
    | {| type: 'identity', property: string, default?: T |};

declare type CompositeFunctionSpecification<T> =
    | {| type: 'exponential', stops: Array<[{zoom: number, value: number}, T]>, property: string, default?: T |}
    | {| type: 'interval',    stops: Array<[{zoom: number, value: number}, T]>, property: string, default?: T |}
    | {| type: 'categorical', stops: Array<[{zoom: number, value: string | number | boolean}, T]>, property: string, default?: T |};

declare type ExpressionSpecification = Array<mixed>;

declare type PropertyValueSpecification<T> =
    | T
    | CameraFunctionSpecification<T>
    | ExpressionSpecification;

declare type DataDrivenPropertyValueSpecification<T> =
    | T
    | CameraFunctionSpecification<T>
    | SourceFunctionSpecification<T>
    | CompositeFunctionSpecification<T>
    | ExpressionSpecification;

${flowObjectDeclaration('StyleSpecification', spec.$root)}

${flowObjectDeclaration('LightSpecification', spec.light)}

${spec.source.map(key => flowObjectDeclaration(flowSourceTypeName(key), spec[key])).join('\n\n')}

declare type SourceSpecification =
${spec.source.map(key => `    | ${flowSourceTypeName(key)}`).join('\n')}

${layerTypes.map(key => flowLayer(key)).join('\n\n')}

declare type LayerSpecification =
${layerTypes.map(key => `    | ${flowLayerTypeName(key)}`).join('\n')};

`);
