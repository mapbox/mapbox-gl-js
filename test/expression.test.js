import { expression as expressionSuite } from './integration';
import { createPropertyExpression } from '../src/style-spec/expression';
import { toString } from '../src/style-spec/expression/types';
import ignores from './ignores.json';

let tests;

if (process.argv[1] === __filename && process.argv.length > 2) {
    tests = process.argv.slice(2);
}

expressionSuite.run('js', { ignores, tests }, (fixture) => {
    const spec = Object.assign({}, fixture.propertySpec);
    spec['function'] = true;
    spec['property-function'] = true;

    let expression = createPropertyExpression(fixture.expression, spec);
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

    const type = expression._styleExpression.expression.type; // :scream:

    const outputs = [];
    const result = {
        outputs,
        compiled: {
            result: 'success',
            isFeatureConstant: expression.kind === 'constant' || expression.kind === 'camera',
            isZoomConstant: expression.kind === 'constant' || expression.kind === 'source',
            type: toString(type)
        }
    };

    for (const input of fixture.inputs || []) {
        try {
            const feature = { properties: input[1].properties || {} };
            if ('id' in input[1]) {
                feature.id = input[1].id;
            }
            if ('geometry' in input[1]) {
                feature.type = input[1].geometry.type;
            }
            let value = expression.evaluateWithoutErrorHandling(input[0], feature);
            if (type.kind === 'color') {
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
