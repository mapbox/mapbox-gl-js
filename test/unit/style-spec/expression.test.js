import { test } from 'mapbox-gl-js-test';
import { createPropertyExpression } from '../../../src/style-spec/expression';
import definitions from '../../../src/style-spec/expression/definitions';
import v8 from '../../../src/style-spec/reference/v8';
import {expressions as definitionMetadata} from '../../../docs/components/expression-metadata';

// filter out interal "error" and "filter-*" expressions from definition list
const filterExpressionRegex = /filter-/;
const definitionList = Object.keys(definitions).filter((expression) => {
    return expression !== 'error' && !filterExpressionRegex.exec(expression);
}).sort();

test('v8.json includes all definitions from style-spec', (t) => {
    const v8List = Object.keys(v8.expression_name.values);
    t.deepEquals(definitionList, v8List.sort());
    t.end();
});

test('expression metadata includes all definitions from style-spec', (t) => {
    const definitionMetadataList = Object.keys(definitionMetadata);
    t.deepEquals(definitionList, definitionMetadataList.sort());
    t.end();
});

test('createPropertyExpression', (t) => {
    test('prohibits non-interpolable properties from using an "interpolate" expression', (t) => {
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
        t.equal(result, 'error');
        t.equal(value.length, 1);
        t.equal(value[0].message, '"interpolate" expressions cannot be used with this property');
        t.end();
    });

    t.end();
});

test('evaluate expression', (t) => {
    test('warns and falls back to default for invalid enum values', (t) => {
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

        t.stub(console, 'warn');

        t.equal(value.kind, 'source');

        t.equal(value.evaluate({}, { properties: {x: 'b'} }), 'b');
        t.equal(value.evaluate({}, { properties: {x: 'invalid'} }), 'a');
        t.ok(console.warn.calledWith(`Expected value to be one of "a", "b", "c", but found "invalid" instead.`));

        t.end();
    });

    t.end();
});
