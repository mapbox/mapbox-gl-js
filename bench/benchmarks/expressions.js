// @flow

const Benchmark = require('../lib/benchmark');
const accessToken = require('../lib/access_token');
const spec = require('../../src/style-spec/reference/latest');
const convertFunction = require('../../src/style-spec/function/convert');
const {isFunction, createFunction} = require('../../src/style-spec/function');
const {createPropertyExpression} = require('../../src/style-spec/expression');

import type {StylePropertySpecification} from '../../src/style-spec/style-spec';
import type {StylePropertyExpression} from '../../src/style-spec/expression';

class ExpressionBenchmark extends Benchmark {
    data: Array<{
        propertySpec: StylePropertySpecification,
        rawValue: mixed,
        rawExpression: mixed,
        compiledFunction: StylePropertyExpression,
        compiledExpression: StylePropertyExpression
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
                        const compiledExpression = createPropertyExpression(rawExpression, propertySpec);
                        if (compiledExpression.result === 'error') {
                            throw new Error(compiledExpression.value.map(err => `${err.key}: ${err.message}`).join(', '));
                        }
                        return {
                            propertySpec,
                            rawValue,
                            rawExpression,
                            compiledFunction,
                            compiledExpression: compiledExpression.value
                        };
                    };

                    for (const key in layer.paint) {
                        if (isFunction(layer.paint[key])) {
                            this.data.push(expressionData(layer.paint[key], spec[`paint_${layer.type}`][key]));
                        }
                    }

                    for (const key in layer.layout) {
                        if (isFunction(layer.layout[key])) {
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
            createPropertyExpression(rawExpression, propertySpec);
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
