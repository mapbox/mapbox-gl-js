'use strict';

require('flow-remove-types/register');
const util = require('../src/util/util');
const expressionSuite = require('./integration').expression;
const compileExpression = require('../src/style-spec/function/compile');

let tests;

if (process.argv[1] === __filename && process.argv.length > 2) {
    tests = process.argv.slice(2);
}

expressionSuite.run('js', {tests: tests}, (fixture) => {
    const compiled = compileExpression(fixture.expression);

    const testResult = {
        compileResult: util.pick(compiled, ['result', 'functionSource', 'isFeatureConstant', 'isZoomConstant', 'errors'])
    };
    if (compiled.result === 'success') testResult.compileResult.type = compiled.expression.getResultType().name;

    if (compiled.result === 'success' && fixture.evaluate) {
        const evaluateResults = [];
        for (const input of fixture.evaluate) {
            try {
                const output = compiled.function.apply(null, input);
                evaluateResults.push(output);
            } catch (error) {
                if (error.name === 'ExpressionEvaluationError') {
                    evaluateResults.push({ error: error.toJSON() });
                } else {
                    evaluateResults.push({ error: error.message });
                }
            }
        }
        if (evaluateResults.length) {
            testResult.evaluateResults = evaluateResults;
        }
    }

    return testResult;
});
