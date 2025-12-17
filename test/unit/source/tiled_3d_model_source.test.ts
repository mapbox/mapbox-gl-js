// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, waitFor} from '../../util/vitest';
import {mockFetch} from '../../util/network';
import Tiled3DModelSource from '../../../3d-style/source/tiled_3d_model_source';
import {Evented} from '../../../src/util/evented';
import {RequestManager} from '../../../src/util/mapbox';
import sourceFixture from '../../fixtures/source.json';

const wrapDispatcher = (dispatcher) => {
    return {
        getActor() {
            return dispatcher;
        },
        ready: true
    };
};

const mockDispatcher = wrapDispatcher({
    send() {}
});

function createSource(options) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const source = new Tiled3DModelSource('id', options, mockDispatcher, new Evented());

    source.onAdd({
        getWorldview() { },
        _getMapId: () => 1,
        _requestManager: new RequestManager(),
        _language: null,
        style: {
            clearSource: () => {}
        }
    });

    source.on('error', (e) => {
        throw e.error;
    });

    return source;
}

describe('Tiled3DModelSource', () => {
    test('can be constructed from TileJSON', async () => {
        const source = createSource({
            type: 'batched-model',
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.glb"]
        });

        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            expect(source.tiles).toEqual(["http://example.com/{z}/{x}/{y}.glb"]);
            expect(source.minzoom).toEqual(1);
            expect(source.maxzoom).toEqual(10);
            expect(source.attribution).toEqual("Mapbox");
        }
    });

    test('can be constructed from a TileJSON URL', async () => {
        mockFetch({
            '/source.json': () => new Response(JSON.stringify(sourceFixture))
        });

        const source = createSource({
            type: 'batched-model',
            url: "/source.json"
        });

        const e = await waitFor(source, "data");
        if (e.sourceDataType === 'metadata') {
            expect(source.tiles).toEqual(["http://example.com/{z}/{x}/{y}.png"]);
            expect(source.minzoom).toEqual(1);
            expect(source.maxzoom).toEqual(10);
            expect(source.attribution).toEqual("Mapbox");
        }
    });
});
