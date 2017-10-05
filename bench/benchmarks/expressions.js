// @flow

const Benchmark = require('../lib/benchmark');
const accessToken = require('../lib/access_token');
const spec = require('../../src/style-spec/reference/latest');
const createFunction = require('../../src/style-spec/function');
const convertFunction = require('../../src/style-spec/function/convert');
const {
    isExpression,
    createExpressionWithErrorHandling,
    getExpectedType,
    getDefaultValue
} = require('../../src/style-spec/expression');

import type {
    StyleExpression,
    StylePropertySpecification
} from '../../src/style-spec/expression';

class ExpressionBenchmark extends Benchmark {
    data: Array<{
        propertySpec: StylePropertySpecification,
        rawValue: mixed,
        rawExpression: mixed,
        compiledFunction: StyleExpression,
        compiledExpression: StyleExpression
    }>;

    setup() {
        return fetch(`https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=${accessToken}`)
            .then(response => response.json())
            .then(json => {
                this.data = [];

                for (const layer of json.layers) {
                    if (layer.ref) {
                        continue;
                    }

                    const expressionData = function(rawValue, propertySpec: StylePropertySpecification) {
                        const rawExpression = convertFunction(rawValue, propertySpec);
                        const compiledFunction = createFunction(rawValue, propertySpec);
                        const compiledExpression = createExpressionWithErrorHandling(rawExpression, {
                            context: 'declaration',
                            expectedType: getExpectedType(propertySpec),
                            defaultValue: getDefaultValue(propertySpec)
                        });
                        return {
                            propertySpec,
                            rawValue,
                            rawExpression,
                            compiledFunction,
                            compiledExpression
                        };
                    };

                    for (const key in layer.paint) {
                        if (isExpression(layer.paint[key])) {
                            this.data.push(expressionData(layer.paint[key], spec[`paint_${layer.type}`][key]));
                        }
                    }

                    for (const key in layer.layout) {
                        if (isExpression(layer.layout[key])) {
                            this.data.push(expressionData(layer.layout[key], spec[`layout_${layer.type}`][key]));
                        }
                    }
                }
            });
    }
}

class FunctionCreate extends ExpressionBenchmark {
    bench() {
        for (const {rawValue, propertySpec} of this.data) {
            createFunction(rawValue, propertySpec);
        }
    }
}

class FunctionEvaluate extends ExpressionBenchmark {
    bench() {
        for (const {compiledFunction} of this.data) {
            compiledFunction.evaluate({zoom: 0});
        }
    }
}

class FunctionConvert extends ExpressionBenchmark {
    bench() {
        for (const {rawValue, propertySpec} of this.data) {
            convertFunction(rawValue, propertySpec);
        }
    }
}

class ExpressionCreate extends ExpressionBenchmark {
    bench() {
        for (const {rawExpression, propertySpec} of this.data) {
            createExpressionWithErrorHandling(rawExpression, {
                context: 'declaration',
                expectedType: getExpectedType(propertySpec),
                defaultValue: getDefaultValue(propertySpec)
            });
        }
    }
}

class ExpressionEvaluate extends ExpressionBenchmark {
    bench() {
        for (const {compiledExpression} of this.data) {
            compiledExpression.evaluate({zoom: 0});
        }
    }
}

module.exports = [
    FunctionCreate,
    FunctionConvert,
    FunctionEvaluate,
    ExpressionCreate,
    ExpressionEvaluate
];
