// @flow

import assert from 'assert';
import promisify from 'pify';
import Protobuf from 'pbf';
import VT from '@mapbox/vector-tile';

import WorkerTile from '../../src/source/worker_tile';
import {type WorkerTileResult} from '../../src/source/worker_source';
import {OverscaledTileID} from '../../src/source/tile_id';
import StyleLayerIndex from '../../src/style/style_layer_index';

export default function parseTiles(sourceID: string,
                                   tiles: Array<{tileID: OverscaledTileID, buffer: ArrayBuffer}>,
                                   layerIndex: StyleLayerIndex,
                                   loadImages: Function,
                                   loadGlyphs: Function): Promise<Array<WorkerTileResult>> {
    let promise: Promise<void> = Promise.resolve();

    const actor = {
        send(action, params, callback) {
            setTimeout(() => {
                if (action === 'getImages') {
                    loadImages(params, callback);
                } else if (action === 'getGlyphs') {
                    loadGlyphs(params, callback);
                } else assert(false);
            }, 0);
        }
    };

    const results = [];
    for (const {tileID, buffer} of tiles) {
        promise = promise.then(() => {
            const workerTile = new WorkerTile({
                tileID: tileID,
                zoom: tileID.overscaledZ,
                tileSize: 512,
                overscaling: 1,
                showCollisionBoxes: false,
                source: sourceID,
                uid: '0',
                maxZoom: 22,
                pixelRatio: 1,
                request: {
                    url: ''
                },
                angle: 0,
                pitch: 0,
                cameraToCenterDistance: 0,
                cameraToTileDistance: 0
            });

            const tile = new VT.VectorTile(new Protobuf(buffer));
            const parse = promisify(workerTile.parse.bind(workerTile));

            return parse(tile, layerIndex, actor)
                .then(result => results.push(result));
        });
    }

    return promise.then(() => results);
}
