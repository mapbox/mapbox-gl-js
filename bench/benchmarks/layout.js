// @flow

import type {StyleSpecification} from '../../src/style-spec/types';
import Benchmark from '../lib/benchmark';
import fetchStyle from '../lib/fetch_style';
import TileParser from '../lib/tile_parser';
import { OverscaledTileID } from '../../src/source/tile_id';

export default class Layout extends Benchmark {
    tiles: Array<{tileID: OverscaledTileID, buffer: ArrayBuffer}>;
    parser: TileParser;
    style: string | StyleSpecification;
    locations: Array<OverscaledTileID>;

    constructor(style: string | StyleSpecification, locations: ?Array<OverscaledTileID>) {
        super();
        this.style = style;
        this.locations = locations || this.tileIDs();
    }

    tileIDs(): Array<OverscaledTileID> {
        return [
            new OverscaledTileID(12, 0, 12, 655, 1583),
            new OverscaledTileID(8, 0, 8, 40, 98),
            new OverscaledTileID(4, 0, 4, 3, 6),
            new OverscaledTileID(0, 0, 0, 0, 0)
        ];
    }

    setup(): Promise<void> {
        return fetchStyle(this.style)
            .then((styleJSON) => {
                this.parser = new TileParser(styleJSON, 'composite');
                return this.parser.setup();
            })
            .then(() => {
                return Promise.all(this.locations.map(tileID => this.parser.fetchTile(tileID)));
            })
            .then((tiles) => {
                this.tiles = tiles;
                // parse tiles once to populate glyph/icon cache
                return Promise.all(tiles.map(tile => this.parser.parseTile(tile)));
            })
            .then(() => {});
    }

    bench() {
        let promise = Promise.resolve();
        for (const tile of this.tiles) {
            promise = promise.then(() => {
                return this.parser.parseTile(tile).then(() => {});
            });
        }
        return promise;
    }
}
