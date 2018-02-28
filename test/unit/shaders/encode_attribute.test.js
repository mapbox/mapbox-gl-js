import { test } from 'mapbox-gl-js-test';
import encode from '../../../src/shaders/encode_attribute';

test('packUint8ToFloat', (t) => {
    t.equal(encode.packUint8ToFloat(0, 0), 0);
    t.equal(encode.packUint8ToFloat(255, 255), 65535);
    t.equal(encode.packUint8ToFloat(123, 45), 31533);

    t.equal(encode.packUint8ToFloat(-1, -1), 0);
    t.equal(encode.packUint8ToFloat(256, 256), 65535);

    t.end();
});
