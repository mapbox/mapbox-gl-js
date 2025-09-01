// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect} from '../../util/vitest';
import * as spec from '../../../src/style-spec/style-spec';

['v8', 'latest'].forEach((version) => {
    ['', 'min'].forEach((kind) => {
        const v = version + kind;
        test(v, () => {
            for (const k in spec[v]) {
                // Exception for version.
                if (k === '$version') {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    expect(typeof spec[v].$version).toEqual('number');
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const props = spec[v][objKey];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const propKeys = Object.keys(props);
        propKeys.forEach((key) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(props[key]["sdk-support"]).toBeTruthy();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (props[key]["sdk-support"]) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(props[key]["sdk-support"]["basic functionality"]).toBeTruthy();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                if (props[key]["property-type"].includes("constant")) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    expect(props[key]["sdk-support"]["data-driven styling"]).toBeFalsy();
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    expect(props[key]["sdk-support"]["data-driven styling"]).toBeTruthy();
                }
            }
        });
    });

    const expressions = spec[v].expression_name.values;
    const expressionNames = Object.keys(expressions);
    expressionNames.forEach((expr) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(expressions[expr]["sdk-support"]).toBeTruthy();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (expressions[expr]["sdk-support"]) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(expressions[expr]["sdk-support"]["basic functionality"]).toBeTruthy();
        }
    });
});
function validSchema(k, name, obj, ref, version, kind) {
    const scalar = ['boolean', 'string', 'number'];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
        'use-theme',
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
        'private',
        'experimental',
        'appearance',
        'supported-layer-types'
    ];

    // Schema object.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (Array.isArray(obj.type) || typeof obj.type === 'string') {
        // schema must have only known keys
        for (const attr in obj) {
            expect(keys.includes(attr), `Unknown key "${attr}" in "${k}"`).toBeTruthy();
        }

        // schema type must be js native, 'color', or present in ref root object.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        expect(types.indexOf(obj.type) !== -1).toBeTruthy();

        // schema type is an enum, it must have 'values' and they must be
        // objects (>=v8) or scalars (<=v7). If objects, check that doc key
        // (if present) is a string.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (obj.type === 'enum') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
            const values = (ref.$version >= 8 ? Object.keys(obj.values) : obj.values);
            expect(Array.isArray(values) && values.every((v) => {
                return scalar.indexOf(typeof v) !== -1;
            })).toBeTruthy();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (ref.$version >= 8) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                for (const v in obj.values) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    if (Array.isArray(obj.values) === false) { // skips $root.version
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        if (obj.values[v].doc !== undefined) {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            expect('string').toEqual(typeof obj.values[v].doc);
                            if (kind === 'min') expect.unreachable(`minified file should not have ${k}.doc`);
                        } else if (name === 'latest') expect.unreachable(`doc missing for ${k}`);
                    }
                }
            }
        }

        // schema type is array, it must have 'value' and it must be a type.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (obj.value !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (Array.isArray(obj.value)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                obj.value.forEach((i) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    expect(types.indexOf(i) !== -1).toBeTruthy();
                });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            } else if (typeof obj.value === 'object') {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                validSchema(`${k}.value`, name, obj.value, ref);
            } else {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                expect(types.indexOf(obj.value) !== -1).toBeTruthy();
            }
        }

        // schema key doc checks
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (obj.doc !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect('string').toEqual(typeof obj.doc);
            if (kind === 'min') expect.unreachable(`minified file should not have ${k}.doc`);
        } else if (name === 'latest') expect.unreachable(`doc missing for ${k}`);

        // schema key example checks
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (kind === 'min' && obj.example !== undefined) {
            expect.unreachable(`minified file should not have ${k}.example`);
        }

        // schema key function checks
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (obj.function !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(ref.$version < 8).toBeTruthy();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (ref.$version >= 7) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                expect(true).toEqual(['interpolated', 'piecewise-constant'].indexOf(obj.function) >= 0);
            } else {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect('boolean').toEqual(typeof obj.function);
            }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        } else if (obj.expression !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const expression = obj.expression;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(ref['property-type'][obj['property-type']]).toBeTruthy();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect('boolean').toEqual(typeof expression.interpolated);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (expression.parameters) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                expect(true).toEqual(Array.isArray(expression.parameters));
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (obj['property-type'] !== 'color-ramp') {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    expect(true).toEqual(expression.parameters.every(k => {
                        return k === 'zoom' ||
                            k === 'feature' ||
                            k === 'feature-state' ||
                            k === 'pitch' ||
                            k === 'distance-from-center' ||
                            k === 'measure-light' ||
                            k === 'line-progress';
                    }));
                }
            }
        }

        // schema key required checks
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (obj.required !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect('boolean').toEqual(typeof obj.required);
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (obj.required && obj.optional) {
            expect.unreachable(`${k} is marked as "required" and "optional" at the same time`);
        }

        // schema key transition checks
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (obj.transition !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect('boolean').toEqual(typeof obj.transition);
        }

        // schema key requires checks
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (obj.requires !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            expect(true).toEqual(Array.isArray(obj.requires));
        }
    } else if (Array.isArray(obj)) {
        obj.forEach((child, j) => {
            if (typeof child === 'string' && scalar.indexOf(child) !== -1) return;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            validSchema(`${k}[${j}]`, name,  typeof child === 'string' ? ref[child] : child, ref);
        });
        // Container object.
    } else if (typeof obj === 'object') {
        for (const j in obj) {
            // Skip validation for `experimental: true` keys.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (j === 'experimental' && obj[j] === true) continue;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            validSchema(`${k}.${j}`, name, obj[j], ref);
        }
        // Invalid ref object.
    } else {
        expect(false).toBeTruthy();
    }
}
