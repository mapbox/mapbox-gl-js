import Pbf from 'pbf';
import {describe, test, expect, beforeAll} from 'vitest';
import {readArrayBuffer} from '../../util/read_array_buffer';
import {MapboxRasterTile} from '../../../src/data/mrt/mrt.esm.js';

describe('MapboxRasterTile', () => {
    beforeAll(() => {
        MapboxRasterTile.setPbf(Pbf);
    });
    test('parses an MRT with an icon set', async () => {
        const arrayBuffer = await readArrayBuffer('test/fixtures/iconset-0-0-0.mrt');

        const mrt = new MapboxRasterTile();
        mrt.parseHeader(arrayBuffer);

        const layer = mrt.getLayer('landmark-icons');
        expect(layer.getBandList().length).toEqual(2);
        expect(layer.hasBand('the-shard')).toBe(true);

        const range = layer.getDataRange(['the-shard']);
        expect(range).toMatchObject({firstByte: 158, lastByte: 54527});

        try {
            const task = mrt.createDecodingTask(range);
            const bufferSlice = arrayBuffer.slice(range.firstByte, range.lastByte + 1);
            const result = await MapboxRasterTile.performDecoding(bufferSlice, task);
            task.complete(null, result);
        } catch (error) {
            expect.unreachable(error);
        }

        expect(layer.hasDataForBand('the-shard')).toBe(true);

        const bandView = layer.getBandView('the-shard');
        expect(bandView).toMatchObject({
            data: expect.any(Uint8Array),
            bytes: expect.any(Uint8Array),
            offset: 0,
            scale: 1,
            dimension: 4,
            tileSize: 512,
            pixelFormat: 'uint8',
        });
    });
});
