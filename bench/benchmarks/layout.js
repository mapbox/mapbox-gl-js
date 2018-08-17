// @flow

import Benchmark from '../lib/benchmark';
import fetchStyle from '../lib/fetch_style';
import createStyle from '../lib/create_style';
import fetchTiles from '../lib/fetch_tiles';
import parseTiles from '../lib/parse_tiles';
import StyleLayerIndex from '../../src/style/style_layer_index';
import deref from '../../src/style-spec/deref';
import { OverscaledTileID } from '../../src/source/tile_id';

export default class Layout extends Benchmark {
    glyphs: Object;
    icons: Object;
    layerIndex: StyleLayerIndex;
    tiles: Array<{tileID: OverscaledTileID, buffer: ArrayBuffer}>;

    setup(): Promise<void> {
        const tileIDs = [
            new OverscaledTileID(12, 0, 12, 655, 1583),
            new OverscaledTileID(8, 0, 8, 40, 98),
            new OverscaledTileID(4, 0, 4, 3, 6),
            new OverscaledTileID(0, 0, 0, 0, 0)
        ];

        return fetchStyle(`mapbox://styles/mapbox/streets-v9`)
            .then((styleJSON) => {
                this.layerIndex = new StyleLayerIndex(deref(styleJSON.layers));
                return Promise.all([
                    createStyle(styleJSON),
                    fetchTiles((styleJSON.sources.composite: any).url, tileIDs)
                ]);
            })
            .then(([style, tiles]) => {
                this.tiles = tiles;
                this.glyphs = {};
                this.icons = {};

                const preloadImages = (params, callback) => {
                    style.getImages('', params, (err, icons) => {
                        this.icons[JSON.stringify(params)] = icons;
                        callback(err, icons);
                    });
                };

                const preloadGlyphs = (params, callback) => {
                    style.getGlyphs('', params, (err, glyphs) => {
                        this.glyphs[JSON.stringify(params)] = glyphs;
                        callback(err, glyphs);
                    });
                };

                return parseTiles('composite',
                                  this.tiles,
                                  this.layerIndex,
                                  preloadImages,
                                  preloadGlyphs)
                    .then(() => {});
            });
    }

    bench() {
        const loadGlyphs = (params, callback) => callback(null, this.glyphs[JSON.stringify(params)]);
        const loadImages = (params, callback) => callback(null, this.icons[JSON.stringify(params)]);

        return parseTiles('composite',
                          this.tiles,
                          this.layerIndex,
                          loadImages,
                          loadGlyphs)
            .then(() => {});
    }
}
