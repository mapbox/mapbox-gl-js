import Pbf from 'pbf';
// eslint-disable-next-line import/extensions
import {server} from '@vitest/browser/context';
import {describe, test, expect} from 'vitest';
import {readIconSet} from '../../../src/data/usvg/usvg_pb_decoder.js';

async function readArrayBuffer(path: string) {
    const data = await server.commands.readFile(path, 'binary');
    const arrayBuffer = new ArrayBuffer(data.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < data.length; i++) {
        view[i] = data.charCodeAt(i);
    }
    return arrayBuffer;
}

describe('IconSet', () => {
    test('parses an icon set into a JSON', async () => {
        const data = await readArrayBuffer('../../fixtures/iconset.pb');

        const iconSet = readIconSet(new Pbf(data));
        await expect(JSON.stringify(iconSet)).toMatchFileSnapshot('__snapshots__/iconset.json');
    });
});
