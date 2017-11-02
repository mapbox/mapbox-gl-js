'use strict';

require('flow-remove-types/register');
const expressionSuite = require('./integration').expression;
const { createExpression } = require('../src/style-spec/expression');
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

    const expression = createExpression(fixture.expression, spec, 'property', {handleErrors: false});
    if (expression.result === 'error') {
        return {
            compiled: {
                result: expression.result,
                errors: expression.errors.map((err) => ({
                    key: err.key,
                    error: err.message
                }))
            }
        };
    }

    const outputs = [];
    const result = {
        outputs,
        compiled: {
            result: expression.result,
            isZoomConstant: expression.isZoomConstant,
            isFeatureConstant: expression.isFeatureConstant,
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
