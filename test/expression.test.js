'use strict';

require('flow-remove-types/register');
const expressionSuite = require('./integration').expression;
const { createPropertyExpression } = require('../src/style-spec/expression');
const { toString } = require('../src/style-spec/expression/types');
const ignores = require('./ignores.json');

let tests;

if (process.argv[1] === __filename && process.argv.length > 2) {
    tests = process.argv.slice(2);
}

expressionSuite.run('js', { ignores, tests }, (fixture) => {
    const spec = fixture.propertySpec || {};
    spec['function'] = true;
    spec['property-function'] = true;

    let expression = createPropertyExpression(fixture.expression, spec, {handleErrors: false});
    if (expression.result === 'error') {
        return {
            compiled: {
                result: 'error',
                errors: expression.value.map((err) => ({
                    key: err.key,
                    error: err.message
                }))
            }
        };
    }

    expression = expression.value;

    const outputs = [];
    const result = {
        outputs,
        compiled: {
            result: 'success',
            isZoomConstant: expression.kind === 'constant' || expression.kind === 'source',
            isFeatureConstant: expression.kind === 'constant' || expression.kind === 'camera',
            type: toString(expression.parsed.type)
        }
    };

    for (const input of fixture.inputs) {
        try {
            const feature = { properties: input[1].properties || {} };
            if ('id' in input[1]) {
                feature.id = input[1].id;
            }
            if ('geometry' in input[1]) {
                feature.type = input[1].geometry.type;
            }
            let value = expression.evaluate(input[0], feature);
            if (expression.parsed.type.kind === 'color') {
                value = [value.r, value.g, value.b, value.a];
            }
            outputs.push(value);
        } catch (error) {
            if (error.name === 'ExpressionEvaluationError') {
                outputs.push({ error: error.toJSON() });
            } else {
                outputs.push({ error: error.message });
            }
        }
    }

    return result;
});
