// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, vi} from '../../util/vitest';
import {createExpression, createPropertyExpression} from '../../../src/style-spec/expression/index';
import Color from '../../../src/style-spec/util/color';
import validateExpression from '../../../src/style-spec/validate/validate_expression';
import definitions from '../../../src/style-spec/expression/definitions/index';
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(value[0].message).toEqual('"interpolate" expressions cannot be used with this property');
    });
});

describe('createExpression treats inherited Object.prototype member names as unknown operators', () => {
    // an expression array whose first element is "__proto__"/"constructor"/etc resolves via the prototype chain in the
    // plain-object expression registry, so it must not be treated as a registered operator
    test.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'])('%s', (name) => {
        expect(() => createExpression([name])).not.toThrow();
        const {result, value} = createExpression([name]);
        expect(result).toEqual('success');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        expect(value.expression.evaluate({})).toEqual([name]);
    });
});

describe('createExpression treats inherited Object.prototype member names as unbound "var" names', () => {
    test.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'])('%s', (name) => {
        expect(() => createExpression(['var', name])).not.toThrow();
        const {result, value} = createExpression(['var', name]);
        expect(result).toEqual('error');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(value[0].message).toMatch(`Unknown variable "${name}"`);
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

describe('config serialization', () => {
    test.each([
        [['config', 'key']],
        [['config', 'key', 'scope']],
    ])('%j', (expression) => {
        const {result, value} = createExpression(expression);
        expect(result).toEqual('success');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        expect(value.expression.serialize()).toEqual(expression);
    });
});

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
describe('createExpression coerces interpolate of string colors when a color spec is given', () => {
    const expectColorEqual = (actual, expected) => {
        expect(actual).toBeInstanceOf(Color);
        expect(actual.r).toBeCloseTo(expected.r, 5);
        expect(actual.g).toBeCloseTo(expected.g, 5);
        expect(actual.b).toBeCloseTo(expected.b, 5);
        expect(actual.a).toBeCloseTo(expected.a, 5);
    };

    const colorSpec = {
        type: 'color',
        'property-type': 'data-constant',
        expression: {interpolated: true, parameters: ['zoom']}
    };

    test('hsl string colors interpolate when expected type is color', () => {
        const {result, value} = createExpression([
            'interpolate', ['linear'], ['zoom'],
            10, 'hsl(0, 100%, 63%)',
            16, 'hsl(240, 100%, 73%)'
        ], colorSpec);
        expect(result).toEqual('success');
        expect(value.expression.type.kind).toEqual('color');
        expectColorEqual(value.evaluate({zoom: 10}), Color.parse('hsl(0, 100%, 63%)'));
        expectColorEqual(value.evaluate({zoom: 16}), Color.parse('hsl(240, 100%, 73%)'));
    });

    test('hex and named string colors interpolate when expected type is color', () => {
        const {result, value} = createExpression([
            'interpolate', ['linear'], ['zoom'],
            0, '#ff0000',
            10, 'blue'
        ], colorSpec);
        expect(result).toEqual('success');
        expect(value.expression.type.kind).toEqual('color');
        expectColorEqual(value.evaluate({zoom: 0}), new Color(1, 0, 0, 1));
        expectColorEqual(value.evaluate({zoom: 10}), new Color(0, 0, 1, 1));
    });

    test('without a color spec, an interpolate of string colors still errors', () => {
        // The fix is at the call site: callers that know the type (e.g. config
        // option defaults) must pass it. The interpolate operator itself does
        // not silently auto-coerce strings, so consumers that expect a string
        // continue to surface a clear parse error.
        const {result, value} = createExpression([
            'interpolate', ['linear'], ['zoom'],
            0, 'red',
            10, 'blue'
        ]);
        expect(result).toEqual('error');
        expect(value[0].message).toEqual('Type string is not interpolatable.');
    });
});
/* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

describe('evaluate expression', () => {
    test('warns and falls back to default for invalid enum values', () => {
        const {value} = createPropertyExpression(['get', 'x'], {
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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        expect(value.evaluate({}, {properties: {x: 'b'}})).toEqual('b');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        expect(value.evaluate({}, {properties: {x: 'invalid'}})).toEqual('a');
        expect(
            console.warn
        ).toHaveBeenCalledWith(`Failed to evaluate expression \"[\"string\",[\"get\",\"x\"]]\". Expected value to be one of \"a\", \"b\", \"c\", but found \"invalid\" instead.`);
    });
});
