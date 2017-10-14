'use strict';
require('flow-remove-types/register');

const ref = require('../../../src/style-spec/reference/latest');
const toString = require('../../../src/style-spec/expression/types').toString;
const CompoundExpression = require('../../../src/style-spec/expression/compound_expression').CompoundExpression;

// registers compound expressions
require('../../../src/style-spec/expression/definitions');

const types = {
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
    'to-number': [{
        type: 'number',
        parameters: ['value', { repeat: [ 'fallback: value' ] }]
    }],
    'to-color': [{
        type: 'color',
        parameters: ['value', { repeat: [ 'fallback: value' ] }]
    }],
    at: [{
        type: 'T',
        parameters: ['number', 'array']
    }],
    case: [{
        type: 'T',
        parameters: [{ repeat: ['condition: boolean', 'output: T'] }, 'default: T']
    }],
    coalesce: [{
        type: 'T',
        parameters: [{repeat: 'T'}]
    }],
    curve: [{
        type: 'T',
        parameters: [
            'input: value',
            '["step"]',
            'stop_output_0: T',
            'stop_input_1: number, stop_output_1: T',
            'stop_input_n: number, stop_output_n: T, ...'
        ]
    }, {
        type: 'T (number, array<number>, or Color)',
        parameters: [
            'input: number',
            'interpolation: ["linear"] | ["exponential", base] | ["cubic-bezier", x1, y1, x2, y2 ]',
            'stop_input_1: number, stop_output_1: T',
            'stop_input_n: number, stop_output_n: T, ...'
        ]
    }],
    let: [{
        type: 'T',
        parameters: [{ repeat: ['string (alphanumeric literal)', 'any']}, 'T']
    }],
    literal: [{
        type: 'array<T, N>',
        parameters: ['[...] (JSON array literal)']
    }, {
        type: 'Object',
        parameters: ['{...} (JSON object literal)']
    }],
    match: [{
        type: 'U',
        parameters: [
            'input: T (number or string)',
            'label_1: T | [T, T, ...], output_1: U',
            'label_n: T | [T, T, ...], output_n: U, ...',
            'default: U'
        ]
    }],
    var: [{
        type: 'the type of the bound expression',
        parameters: ['previously bound variable name']
    }]
};

for (const name in CompoundExpression.definitions) {
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

const expressions = {};
const expressionGroups = {};
for (const name in types) {
    const spec = ref['expression_name'].values[name];
    expressionGroups[spec.group] = expressionGroups[spec.group] || [];
    expressionGroups[spec.group].push(name);
    expressions[name] = {
        group: spec.group.toLowerCase().replace(/[^a-zA-Z]+/g, '-'),
        name: name,
        doc: spec.doc,
        type: types[name]
    };
}

function processParameters(params) {
    if (Array.isArray(params)) {
        return params.map(toString);
    } else {
        return [{repeat: [toString(params.type)]}];
    }
}

module.exports = {expressions, expressionGroups};
