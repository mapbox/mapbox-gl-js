// @flow

import Benchmark from '../lib/benchmark';

import spec from '../../src/style-spec/reference/latest';
import convertFunction from '../../src/style-spec/function/convert';
import { isFunction, createFunction } from '../../src/style-spec/function';
import { createPropertyExpression } from '../../src/style-spec/expression';
import { normalizeStyleURL } from '../../src/util/mapbox';

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
    style: string;

    constructor(style: string) {
        super();
        this.style = style;
    }

    setup() {
        return fetch(normalizeStyleURL(this.style))
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

export default [
    FunctionCreate,
    FunctionConvert,
    FunctionEvaluate,
    ExpressionCreate,
    ExpressionEvaluate
];
