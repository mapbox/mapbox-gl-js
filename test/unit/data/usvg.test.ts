import Pbf from 'pbf';
import {describe, test, expect} from 'vitest';
import {readArrayBuffer} from '../../util/read_array_buffer';
import {readIconSet, buildStretchedAreas} from '../../../src/data/usvg/usvg_pb_decoder';

describe('IconSet', () => {
    test('parses an icon set into a JSON', async () => {
        const data = await readArrayBuffer('test/fixtures/iconset.pb');

        const iconSet = readIconSet(new Pbf(data));
        await expect(JSON.stringify(iconSet)).toMatchFileSnapshot('__snapshots__/iconset.json');
    });

    test.each([
        [[0, 5, 2, 3, 3, 7], [[0, 5], [7, 10], [13, 20]]],
        [[0, 3, 10, 13, 5, 8], [[0, 3], [13, 26], [31, 39]]],
    ])('stretch %o converted to areas %o by buildStretchAreas', (stretch, expected) => {
        const metadata = {'stretch_x': stretch};
        buildStretchedAreas(metadata, 'x');

        expect(metadata['stretch_x_areas']).toEqual(expected);
    });
});
