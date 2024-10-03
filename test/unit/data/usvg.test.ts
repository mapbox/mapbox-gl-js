import Pbf from 'pbf';
import {server} from '@vitest/browser/context';
import {describe, test, expect, vi} from '../../util/vitest';
import {readIconSet} from '../../../src/data/usvg/usvg_pb_decoder';

async function readJson(path: string) {
    const data = await server.commands.readFile(path);
    return JSON.parse(data);
}

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
        const json = await readJson('../../fixtures/iconset.json');

        const iconSet = readIconSet(new Pbf(data));
        expect(iconSet).toStrictEqual(json);
    });
});
