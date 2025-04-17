// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect} from '../../util/vitest';
import {packUint8ToFloat} from '../../../src/shaders/encode_attribute';

test('packUint8ToFloat', () => {
    expect(packUint8ToFloat(0, 0)).toEqual(0);
    expect(packUint8ToFloat(255, 255)).toEqual(65535);
    expect(packUint8ToFloat(123, 45)).toEqual(31533);

    expect(packUint8ToFloat(-1, -1)).toEqual(0);
    expect(packUint8ToFloat(256, 256)).toEqual(65535);
});
