/* eslint-disable no-new-wrappers */
import {test, expect, assertType, expectTypeOf} from 'vitest';
import {getType, isObject, isString, isNumber, isBoolean} from '../../../../src/style-spec/util/get_type';

test('isObject: comprehensive behavior', () => {
    // Should return true for plain objects
    expect(isObject({})).toBe(true);
    expect(isObject({a: 1, b: 2})).toBe(true);
    expect(isObject(new Date())).toBe(true);
    expect(isObject(/test/)).toBe(true);
    expect(isObject(new Error('test'))).toBe(true);

    // Should return false for non-objects
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject([1, 2, 3])).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject('hello')).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject(true)).toBe(false);
    expect(isObject(() => {})).toBe(false);

    // Should return false for boxed primitives
    expect(isObject(new String('hello'))).toBe(false);
    expect(isObject(new Number(42))).toBe(false);
    expect(isObject(new Boolean(true))).toBe(false);
});

test('isString: comprehensive behavior', () => {
    // Should return true for strings
    expect(isString('hello')).toBe(true);
    expect(isString('')).toBe(true);
    expect(isString(new String('hello'))).toBe(true);

    // Should return false for non-strings
    expect(isString(42)).toBe(false);
    expect(isString(true)).toBe(false);
    expect(isString([1, 2, 3])).toBe(false);
    expect(isString({})).toBe(false);
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
});

test('isNumber: comprehensive behavior', () => {
    // Should return true for numbers
    expect(isNumber(42)).toBe(true);
    expect(isNumber(0)).toBe(true);
    expect(isNumber(NaN)).toBe(true);
    expect(isNumber(Infinity)).toBe(true);
    expect(isNumber(-Infinity)).toBe(true);
    expect(isNumber(new Number(42))).toBe(true);

    // Should return false for non-numbers
    expect(isNumber('hello')).toBe(false);
    expect(isNumber(true)).toBe(false);
    expect(isNumber([1, 2, 3])).toBe(false);
    expect(isNumber({})).toBe(false);
    expect(isNumber(null)).toBe(false);
    expect(isNumber(undefined)).toBe(false);
    expect(isNumber(BigInt(123))).toBe(false);
});

test('isBoolean: comprehensive behavior', () => {
    // Should return true for booleans
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean(new Boolean(true))).toBe(true);

    // Should return false for non-booleans
    expect(isBoolean('hello')).toBe(false);
    expect(isBoolean(42)).toBe(false);
    expect(isBoolean([1, 2, 3])).toBe(false);
    expect(isBoolean({})).toBe(false);
    expect(isBoolean(null)).toBe(false);
    expect(isBoolean(undefined)).toBe(false);
    expect(isBoolean(0)).toBe(false);
    expect(isBoolean(1)).toBe(false);
    expect(isBoolean('')).toBe(false);
});

test('getType: should match original getType behavior', () => {
    expect(getType({})).toBe('object');
    expect(getType([1, 2, 3])).toBe('array');
    expect(getType('hello')).toBe('string');
    expect(getType(42)).toBe('number');
    expect(getType(true)).toBe('boolean');
    expect(getType(null)).toBe('null');
    expect(getType(undefined)).toBe('undefined');
    expect(getType(() => {})).toBe('function');
    expect(getType(NaN)).toBe('number');
    expect(getType(Symbol('test'))).toBe('symbol');
    expect(getType(BigInt(123))).toBe('bigint');

    expect(getType(new String('hello'))).toBe('string');
    expect(getType(new Number(42))).toBe('number');
    expect(getType(new Boolean(true))).toBe('boolean');
});

test('TypeScript function signatures and type narrowing', () => {
    // All type guards should have correct signatures
    expectTypeOf(isObject).returns.toEqualTypeOf<boolean>();
    expectTypeOf(isObject).parameter(0).toEqualTypeOf<unknown>();
    expectTypeOf(isString).returns.toEqualTypeOf<boolean>();
    expectTypeOf(isString).parameter(0).toEqualTypeOf<unknown>();
    expectTypeOf(isNumber).returns.toEqualTypeOf<boolean>();
    expectTypeOf(isNumber).parameter(0).toEqualTypeOf<unknown>();
    expectTypeOf(isBoolean).returns.toEqualTypeOf<boolean>();
    expectTypeOf(isBoolean).parameter(0).toEqualTypeOf<unknown>();
    expectTypeOf(getType).returns.toEqualTypeOf<"number" | "string" | "boolean" | "array" | "null" | "object" | "function" | "bigint" | "symbol" | "undefined" | "NaN">();
    expectTypeOf(getType).parameter(0).toEqualTypeOf<unknown>();

    // Type narrowing should work correctly
    const objectValue: unknown = {a: 1};
    if (isObject(objectValue)) {
        expect(typeof objectValue).toBe('object');
        expect(objectValue).not.toBe(null);
        expect(Array.isArray(objectValue)).toBe(false);
        expectTypeOf(objectValue).toEqualTypeOf<Record<PropertyKey, unknown>>();
        assertType<object>(objectValue);
    }

    const stringValue: unknown = 'hello';
    if (isString(stringValue)) {
        expect(stringValue).toBe('hello');
        expectTypeOf(stringValue).toEqualTypeOf<string>();
        assertType<string>(stringValue);
    }

    const numberValue: unknown = 42;
    if (isNumber(numberValue)) {
        expect(numberValue.toString()).toBe('42');
        expectTypeOf(numberValue).toEqualTypeOf<number>();
        assertType<number>(numberValue);
    }

    const booleanValue: unknown = true;
    if (isBoolean(booleanValue)) {
        expect(typeof booleanValue).toBe('boolean');
        expectTypeOf(booleanValue).toEqualTypeOf<boolean>();
        assertType<boolean>(booleanValue);
    }
});
