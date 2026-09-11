import {PbfReader} from 'pbf';
import {describe, test, expect} from 'vitest';
import {readArrayBuffer} from '../../util/read_array_buffer';
import {readIconSetLazy, decodePendingUsvgTree, buildStretchedAreas} from '../../../src/data/usvg/usvg_pb_decoder';

async function readIconSet() {
    const data = await readArrayBuffer('test/fixtures/iconset.pb');
    return readIconSetLazy(new PbfReader(data));
}

describe('IconSet', () => {
    test('readIconSetLazy reads sizes without the drawings', async () => {
        const {icons} = await readIconSet();
        expect(icons.length).toBeGreaterThan(0);
        for (const icon of icons) {
            expect(icon.usvg_tree.width).toBeGreaterThan(0);
            expect(icon.usvg_tree.height).toBeGreaterThan(0);
            expect(icon.usvg_tree.children).toEqual([]);
        }
    });

    test('decodePendingUsvgTree decodes the drawing', async () => {
        const {icons} = await readIconSet();
        decodePendingUsvgTree(icons[0]);
        expect(icons[0].usvg_tree.children.length).toBeGreaterThan(0);
    });

    test('parses an icon set into a JSON', async () => {
        const iconSet = await readIconSet();
        for (const icon of iconSet.icons) decodePendingUsvgTree(icon);
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
