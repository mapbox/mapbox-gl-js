// @flow

import Layout from './layout';
import SymbolBucket from '../../src/data/bucket/symbol_bucket';
import { performSymbolLayout } from '../../src/symbol/symbol_layout';
import { OverscaledTileID } from '../../src/source/tile_id';

export default class SymbolLayout extends Layout {
    parsedTiles: Array<any>;

    constructor(style: string, locations: ?Array<OverscaledTileID>) {
        super(style, locations);
        this.parsedTiles = [];
    }

    setup(): Promise<void> {
        return super.setup().then(() => {
            // Do initial load/parse of tiles and hold onto all the glyph/icon
            // dependencies so that we can re-do symbol layout in isolation
            // during the bench step.
            return Promise.all(this.tiles.map(tile =>
                this.parser.parseTile(tile, true).then((tileResult) => {
                    this.parsedTiles.push(tileResult);
                })
            )).then(() => {});
        });
    }

    bench() {
        let promise = Promise.resolve();
        for (const tileResult of this.parsedTiles) {
            promise = promise.then(() => {
                for (const bucket of tileResult.buckets) {
                    if (bucket instanceof SymbolBucket) {
                        performSymbolLayout(bucket,
                                            tileResult.glyphMap,
                                            tileResult.glyphPositions,
                                            tileResult.iconMap,
                                            tileResult.imageAtlas.iconPositions,
                                            false);
                    }
                }
            });
        }
        return promise;
    }
}
