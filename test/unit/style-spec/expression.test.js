import {describe, test, expect, vi} from "../../util/vitest.js";
import {createPropertyExpression} from '../../../src/style-spec/expression/index.js';
import validateExpression from '../../../src/style-spec/validate/validate_expression.js';
import definitions from '../../../src/style-spec/expression/definitions/index.js';
import v8 from '../../../src/style-spec/reference/v8.json';

// filter out interal "error" and "filter-*" expressions from definition list
const filterExpressionRegex = /filter-/;
const definitionList = Object.keys(definitions).filter((expression) => {
    return expression !== 'error' && !filterExpressionRegex.exec(expression);
}).sort();

test('v8.json includes all definitions from style-spec', () => {
    const v8List = Object.keys(v8.expression_name.values);
    const v8SupportedList = v8List.filter((expression) => {
        //filter out expressions that are not supported in Mapbox GL JS
        return !!v8.expression_name.values[expression]["sdk-support"]["basic functionality"]["js"];
    });
    expect(definitionList).toStrictEqual(v8SupportedList.sort());
});

describe('createPropertyExpression', () => {
    test('prohibits non-interpolable properties from using an "interpolate" expression', () => {
        const {result, value} = createPropertyExpression([
            'interpolate', ['linear'], ['zoom'], 0, 0, 10, 10
        ], {
            type: 'number',
            'property-type': 'data-constant',
            expression: {
                'interpolated': false,
                'parameters': ['zoom']
            }
        });
        expect(result).toEqual('error');
        expect(value.length).toEqual(1);
        expect(value[0].message).toEqual('"interpolate" expressions cannot be used with this property');
    });
});

describe('validateExpression', () => {
    //see https://github.com/mapbox/mapbox-gl-js/issues/11457
    test('ensure lack of valueSpec does not cause uncaught error', () => {
        const result = validateExpression({
            value: ['get', 'x'],
            expressionContext: 'filter'
        });
        expect(result.length).toEqual(0);
    });
});

describe('evaluate expression', () => {
    test('warns and falls back to default for invalid enum values', () => {
        const {value} = createPropertyExpression([ 'get', 'x' ], {
            type: 'enum',
            values: {a: {}, b: {}, c: {}},
            default: 'a',
            'property-type': 'data-driven',
            expression: {
                'interpolated': false,
                'parameters': ['zoom', 'feature']
            }
        });

        vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(value.kind).toEqual('source');

        expect(value.evaluate({}, {properties: {x: 'b'}})).toEqual('b');
        expect(value.evaluate({}, {properties: {x: 'invalid'}})).toEqual('a');
        expect(
            console.warn
        ).toHaveBeenCalledWith(`Expected value to be one of "a", "b", "c", but found "invalid" instead.`);
    });
});
