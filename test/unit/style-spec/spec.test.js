import {test, expect} from "../../util/vitest.js";

/* eslint-disable import/namespace */
import * as spec from '../../../src/style-spec/style-spec.js';

['v8', 'latest'].forEach((version) => {
    ['', 'min'].forEach((kind) => {
        const v = version + kind;
        test(v, () => {
            for (const k in spec[v]) {
                // Exception for version.
                if (k === '$version') {
                    expect(typeof spec[v].$version).toEqual('number');
                } else {
                    validSchema(k, v, spec[v][k], spec[v], version, kind);
                }
            }
        });
    });
});

test(`v8 Spec SDK Support section`, () => {
    const v = 'v8';
    const propObjs = [].concat(spec[v].paint).concat(spec[v].layout);
    propObjs.forEach((objKey) => {
        const props = spec[v][objKey];
        const propKeys = Object.keys(props);
        propKeys.forEach((key) => {
            expect(props[key]["sdk-support"]).toBeTruthy();
            if (props[key]["sdk-support"]) {
                expect(props[key]["sdk-support"]["basic functionality"]).toBeTruthy();
                if (props[key]["property-type"].includes("constant")) {
                    expect(props[key]["sdk-support"]["data-driven styling"]).toBeFalsy();
                } else {
                    expect(props[key]["sdk-support"]["data-driven styling"]).toBeTruthy();
                }
            }
        });
    });

    const expressions = spec[v].expression_name.values;
    const expressionNames = Object.keys(expressions);
    expressionNames.forEach((expr) => {
        expect(expressions[expr]["sdk-support"]).toBeTruthy();
        if (expressions[expr]["sdk-support"]) {
            expect(expressions[expr]["sdk-support"]["basic functionality"]).toBeTruthy();
        }
    });
});
function validSchema(k, name, obj, ref, version, kind) {
    const scalar = ['boolean', 'string', 'number'];
    const types = Object.keys(ref).concat(['boolean', 'string', 'number',
        'array', 'enum', 'color', '*',
        // new in v8
        'opacity', 'translate-array', 'dash-array', 'offset-array', 'font-array', 'field-template',
        // new enums in v8
        'line-cap-enum',
        'line-join-enum',
        'symbol-placement-enum',
        'rotation-alignment-enum',
        'text-justify-enum',
        'text-anchor-enum',
        'text-transform-enum',
        'visibility-enum',
        'property-type',
        'formatted',
        'resolvedImage',
        'promoteId'
    ]);
    const keys = [
        'default',
        'doc',
        'example',
        'function',
        'zoom-function',
        'property-function',
        'function-output',
        'expression',
        'property-type',
        'length',
        'min-length',
        'required',
        'optional',
        'transition',
        'type',
        'value',
        'units',
        'tokens',
        'values',
        'maximum',
        'minimum',
        'period',
        'requires',
        'sdk-support',
        'overridable',
        'private'
    ];

    // Schema object.
    if (Array.isArray(obj.type) || typeof obj.type === 'string') {
        // schema must have only known keys
        for (const attr in obj) {
            expect(keys.indexOf(attr) !== -1).toBeTruthy();
        }

        // schema type must be js native, 'color', or present in ref root object.
        expect(types.indexOf(obj.type) !== -1).toBeTruthy();

        // schema type is an enum, it must have 'values' and they must be
        // objects (>=v8) or scalars (<=v7). If objects, check that doc key
        // (if present) is a string.
        if (obj.type === 'enum') {
            const values = (ref.$version >= 8 ? Object.keys(obj.values) : obj.values);
            expect(Array.isArray(values) && values.every((v) => {
                return scalar.indexOf(typeof v) !== -1;
            })).toBeTruthy();
            if (ref.$version >= 8) {
                for (const v in obj.values) {
                    if (Array.isArray(obj.values) === false) { // skips $root.version
                        if (obj.values[v].doc !== undefined) {
                            expect('string').toEqual(typeof obj.values[v].doc);
                            if (kind === 'min') expect.unreachable(`minified file should not have ${k}.doc`);
                        } else if (name === 'latest') expect.unreachable(`doc missing for ${k}`);
                    }
                }
            }
        }

        // schema type is array, it must have 'value' and it must be a type.
        if (obj.value !== undefined) {
            if (Array.isArray(obj.value)) {
                obj.value.forEach((i) => {
                    expect(types.indexOf(i) !== -1).toBeTruthy();
                });
            } else if (typeof obj.value === 'object') {
                validSchema(`${k}.value`, name, obj.value, ref);
            } else {
                expect(types.indexOf(obj.value) !== -1).toBeTruthy();
            }
        }

        // schema key doc checks
        if (obj.doc !== undefined) {
            expect('string').toEqual(typeof obj.doc);
            if (kind === 'min') expect.unreachable(`minified file should not have ${k}.doc`);
        } else if (name === 'latest') expect.unreachable(`doc missing for ${k}`);

        // schema key example checks
        if (kind === 'min' && obj.example !== undefined) {
            expect.unreachable(`minified file should not have ${k}.example`);
        }

        // schema key function checks
        if (obj.function !== undefined) {
            expect(ref.$version < 8).toBeTruthy();
            if (ref.$version >= 7) {
                expect(true).toEqual(['interpolated', 'piecewise-constant'].indexOf(obj.function) >= 0);
            } else {
                expect('boolean').toEqual(typeof obj.function);
            }
        } else if (obj.expression !== undefined) {
            const expression = obj.expression;
            expect(ref['property-type'][obj['property-type']]).toBeTruthy();
            expect('boolean').toEqual(typeof expression.interpolated);
            if (expression.parameters) {
                expect(true).toEqual(Array.isArray(expression.parameters));
                if (obj['property-type'] !== 'color-ramp') {
                    expect(true).toEqual(expression.parameters.every(k => {
                        return k === 'zoom' ||
                            k === 'feature' ||
                            k === 'feature-state' ||
                            k === 'pitch' ||
                            k === 'distance-from-center' ||
                            k === 'measure-light';
                    }));
                }
            }
        }

        // schema key required checks
        if (obj.required !== undefined) {
            expect('boolean').toEqual(typeof obj.required);
        }

        if (obj.required && obj.optional) {
            expect.unreachable(`${k} is marked as "required" and "optional" at the same time`);
        }

        // schema key transition checks
        if (obj.transition !== undefined) {
            expect('boolean').toEqual(typeof obj.transition);
        }

        // schema key requires checks
        if (obj.requires !== undefined) {
            expect(true).toEqual(Array.isArray(obj.requires));
        }
    } else if (Array.isArray(obj)) {
        obj.forEach((child, j) => {
            if (typeof child === 'string' && scalar.indexOf(child) !== -1) return;
            validSchema(`${k}[${j}]`, name,  typeof child === 'string' ? ref[child] : child, ref);
        });
        // Container object.
    } else if (typeof obj === 'object') {
        for (const j in obj) validSchema(`${k}.${j}`, name, obj[j], ref);
        // Invalid ref object.
    } else {
        expect(false).toBeTruthy();
    }
}
