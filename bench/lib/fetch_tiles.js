// @flow

import {OverscaledTileID} from '../../src/source/tile_id';
import {normalizeSourceURL, normalizeTileURL} from '../../src/util/mapbox';
import type {TileJSON} from '../../src/types/tilejson';

export default function fetchTiles(sourceURL: string, tileIDs: Array<OverscaledTileID>): Promise<Array<{tileID: OverscaledTileID, buffer: ArrayBuffer}>> {
    return fetch(normalizeSourceURL(sourceURL))
        .then(response => response.json())
        .then((tileJSON: TileJSON) => {
            return Promise.all(tileIDs.map(tileID => {
                return fetch(normalizeTileURL(tileID.canonical.url(tileJSON.tiles)))
                    .then(response => response.arrayBuffer())
                    .then(buffer => ({tileID, buffer}));
            }));
        });
}
