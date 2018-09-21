import ref from '../../src/style-spec/reference/latest';
import { toString } from '../../src/style-spec/expression/types';
import CompoundExpression from '../../src/style-spec/expression/compound_expression';

// registers compound expressions
import '../../src/style-spec/expression/definitions/index';

const comparisonSignatures = [{
    type: 'boolean',
    parameters: ['value', 'value']
}, {
    type: 'boolean',
    parameters: ['value', 'value', 'collator']
}];

const types = {
    '==': comparisonSignatures,
    '!=': comparisonSignatures,
    '<': comparisonSignatures,
    '<=': comparisonSignatures,
    '>': comparisonSignatures,
    '>=': comparisonSignatures,
    string: [{
        type: 'string',
        parameters: ['value']
    }, {
        type: 'string',
        parameters: ['value', { repeat: [ 'fallback: value' ] }]
    }],
    number: [{
        type: 'number',
        parameters: ['value']
    }, {
        type: 'number',
        parameters: ['value', { repeat: [ 'fallback: value' ] }]
    }],
    boolean: [{
        type: 'boolean',
        parameters: ['value']
    }, {
        type: 'boolean',
        parameters: ['value', { repeat: [ 'fallback: value' ] }]
    }],
    array: [{
        type: 'array',
        parameters: ['value'],
    }, {
        type: 'array<type>',
        parameters: [
            'type: "string" | "number" | "boolean"',
            'value'
        ],
    }, {
        type: 'array<type, N>',
        parameters: [
            'type: "string" | "number" | "boolean"',
            'N: number (literal)',
            'value'
        ]
    }],
    object: [{
        type: 'object',
        parameters: ['value']
    }, {
        type: 'object',
        parameters: ['value', { repeat: [ 'fallback: value' ] }]
    }],
    'to-boolean': [{
        type: 'boolean',
        parameters: ['value']
    }],
    'to-color': [{
        type: 'color',
        parameters: ['value', { repeat: [ 'fallback: value' ] }]
    }],
    'to-number': [{
        type: 'number',
        parameters: ['value', { repeat: [ 'fallback: value' ] }]
    }],
    'to-string': [{
        type: 'string',
        parameters: ['value']
    }],
    at: [{
        type: 'ItemType',
        parameters: ['number', 'array']
    }],
    case: [{
        type: 'OutputType',
        parameters: [{ repeat: ['condition: boolean', 'output: OutputType'] }, 'default: OutputType']
    }],
    coalesce: [{
        type: 'OutputType',
        parameters: [{repeat: ['OutputType']}]
    }],
    step: [{
        type: 'OutputType',
        parameters: [
            'input: number',
            'stop_output_0: OutputType',
            'stop_input_1: number, stop_output_1: OutputType',
            'stop_input_n: number, stop_output_n: OutputType, ...'
        ]
    }],
    interpolate: [{
        type: 'OutputType (number, array<number>, or Color)',
        parameters: [
            'interpolation: ["linear"] | ["exponential", base] | ["cubic-bezier", x1, y1, x2, y2 ]',
            'input: number',
            'stop_input_1: number, stop_output_1: OutputType',
            'stop_input_n: number, stop_output_n: OutputType, ...'
        ]
    }],
    'interpolate-hcl': [{
        type: 'Color',
        parameters: [
            'interpolation: ["linear"] | ["exponential", base] | ["cubic-bezier", x1, y1, x2, y2 ]',
            'input: number',
            'stop_input_1: number, stop_output_1: Color',
            'stop_input_n: number, stop_output_n: Color, ...'
        ]
    }],
    'interpolate-lab': [{
        type: 'Color',
        parameters: [
            'interpolation: ["linear"] | ["exponential", base] | ["cubic-bezier", x1, y1, x2, y2 ]',
            'input: number',
            'stop_input_1: number, stop_output_1: Color',
            'stop_input_n: number, stop_output_n: Color, ...'
        ]
    }],
    length: [{
        type: 'number',
        parameters: ['string | array | value']
    }],
    let: [{
        type: 'OutputType',
        parameters: [{ repeat: ['string (alphanumeric literal)', 'any']}, 'OutputType']
    }],
    literal: [{
        type: 'array<T, N>',
        parameters: ['[...] (JSON array literal)']
    }, {
        type: 'Object',
        parameters: ['{...} (JSON object literal)']
    }],
    match: [{
        type: 'OutputType',
        parameters: [
            'input: InputType (number or string)',
            'label_1: InputType | [InputType, InputType, ...], output_1: OutputType',
            'label_n: InputType | [InputType, InputType, ...], output_n: OutputType, ...',
            'default: OutputType'
        ]
    }],
    var: [{
        type: 'the type of the bound expression',
        parameters: ['previously bound variable name']
    }],
    collator: [{
        type: 'collator',
        parameters: [ '{ "case-sensitive": boolean, "diacritic-sensitive": boolean, "locale": string }' ]
    }],
    format: [{
        type: 'formatted',
        parameters: [
            'input_1: string, options_1: { "font-scale": number, "text-font": array<string> }',
            '...',
            'input_n: string, options_n: { "font-scale": number, "text-font": array<string> }'
        ]
    }]
};

for (const name in CompoundExpression.definitions) {
    if (/^filter-/.test(name)) {
        continue;
    }
    const definition = CompoundExpression.definitions[name];
    if (Array.isArray(definition)) {
        types[name] = [{
            type: toString(definition[0]),
            parameters: processParameters(definition[1])
        }];
    } else {
        types[name] = definition.overloads.map((o) => {
            return {
                type: toString(definition.type),
                parameters: processParameters(o[0])
            };
        });
    }
}

delete types['error'];

export const expressions = {};
export const expressionGroups = {};
for (const name in types) {
    const spec = ref['expression_name'].values[name];
    expressionGroups[spec.group] = expressionGroups[spec.group] || [];
    expressionGroups[spec.group].push(name);
    expressions[name] = {
        name: name,
        doc: spec.doc,
        type: types[name],
        sdkSupport: spec['sdk-support']
    };
}

function processParameters(params) {
    if (Array.isArray(params)) {
        return params.map(toString);
    } else {
        return [{repeat: [toString(params.type)]}];
    }
}
