'use strict';
require('flow-remove-types/register');

const ref = require('../../../src/style-spec/reference/latest');
const toString = require('../../../src/style-spec/expression/types').toString;
const CompoundExpression = require('../../../src/style-spec/expression/compound_expression').CompoundExpression;

// registers compound expressions
require('../../../src/style-spec/expression/definitions');

const types = {
    string: [{
        type: 'String',
        parameters: ['Value']
    }, {
        type: 'String',
        parameters: ['Value', { repeat: [ {name: 'fallback', type: 'Value'} ] }]
    }],
    number: [{
        type: 'Number',
        parameters: ['Value']
    }, {
        type: 'Number',
        parameters: ['Value', { repeat: [ {name: 'fallback', type: 'Value'} ] }]
    }],
    boolean: [{
        type: 'Boolean',
        parameters: ['Value']
    }, {
        type: 'Boolean',
        parameters: ['Value', { repeat: [ {name: 'fallback', type: 'Value'} ] }]
    }],
    array: [{
        type: 'Array',
        parameters: ['Value'],
    }, {
        type: 'Array<type>',
        parameters: [
            {name: 'type', type: '"String" | "Number" | "Boolean"'},
            'Value'
        ],
    }, {
        type: 'Array<type, N>',
        parameters: [
            {name: 'type', type: '"String" | "Number" | "Boolean"'},
            {name: 'N', type: 'Number (literal)'},
            'Value'
        ]
    }],
    'to-number': [{
        type: 'Number',
        parameters: ['Value', { repeat: [ {name: 'fallback', type: 'Value'} ] }]
    }],
    'to-color': [{
        type: 'Color',
        parameters: ['Value', { repeat: [ {name: 'fallback', type: 'Value'} ] }]
    }],
    at: [{
        type: 'T',
        parameters: ['Number', 'Array']
    }],
    case: [{
        type: 'T',
        parameters: [{ repeat: ['Boolean', 'T'] }, 'T']
    }],
    coalesce: [{
        type: 'T',
        parameters: [{repeat: 'T'}]
    }],
    contains: [{
        type: 'Boolean',
        parameters: ['T', 'Array<T> | Array<T, N>']
    }],
    curve: [{
        type: 'T',
        parameters: [
            {name: 'input', type: 'Number'},
            '["step"]',
            'T',
            {repeat: ['Number', 'T']}
        ]
    }, {
        type: 'T: Number, ',
        parameters: [
            {name: 'input', type: 'Number'},
            {name: 'interpolation', type: '["step"] | ["linear"] | ["exponential", base] | ["cubic-bezier", x1, y1, x2, y2 ]'},
            {repeat: ['Number', 'T']}
        ]
    }],
    let: [{
        type: 'T',
        parameters: [{ repeat: ['String (alphanumeric literal)', 'any']}, 'T']
    }],
    literal: [{
        type: 'Array<T, N>',
        parameters: ['[...] (JSON array literal)']
    }, {
        type: 'Object',
        parameters: ['{...} (JSON object literal)']
    }],
    match: [{
        type: 'U',
        parameters: [
            {name: 'input', type: 'T: Number (integer literal) | String (literal)'},
            {repeat: ['T | [T, T, ...]', 'U']},
            'U'
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
