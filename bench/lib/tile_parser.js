// @flow

import Protobuf from 'pbf';
import VT from '@mapbox/vector-tile';
import assert from 'assert';

import deref from '../../src/style-spec/deref.js';
import Style from '../../src/style/style.js';
import {Evented} from '../../src/util/evented.js';
import {RequestManager} from '../../src/util/mapbox.js';
import WorkerTile from '../../src/source/worker_tile.js';
import StyleLayerIndex from '../../src/style/style_layer_index.js';

import type {StyleSpecification} from '../../src/style-spec/types.js';
import type {WorkerTileResult} from '../../src/source/worker_source.js';
import type {OverscaledTileID} from '../../src/source/tile_id.js';
import type {TileJSON} from '../../src/types/tilejson.js';

class StubMap extends Evented {
    _requestManager: RequestManager;

    constructor() {
        super();
        this._requestManager = new RequestManager();
    }
}

const mapStub = new StubMap();

function createStyle(styleJSON: StyleSpecification): Promise<Style> {
    return new Promise((resolve, reject) => {
        const style = new Style((mapStub: any));
        style.loadJSON(styleJSON);
        style
            .on('style.load', () => resolve(style))
            .on('error', reject);
    });
}

function fetchTileJSON(requestManager: RequestManager, sourceURL: string): Promise<TileJSON> {
    return fetch(requestManager.normalizeSourceURL(sourceURL))
        .then(response => response.json());
}

export default class TileParser {
    styleJSON: StyleSpecification;
    tileJSON: TileJSON;
    sourceID: string;
    layerIndex: StyleLayerIndex;
    icons: Object;
    glyphs: Object;
    style: Style;
    actor: { send: Function };

    constructor(styleJSON: StyleSpecification, sourceID: string) {
        this.styleJSON = styleJSON;
        this.sourceID = sourceID;
        this.layerIndex = new StyleLayerIndex(deref(this.styleJSON.layers));
        this.glyphs = {};
        this.icons = {};
    }

    loadImages(params: Object, callback: Function) {
        const key = JSON.stringify(params);
        if (this.icons[key]) {
            callback(null, this.icons[key]);
        } else {
            this.style.getImages('', params, (err, icons) => {
                this.icons[key] = icons;
                callback(err, icons);
            });
        }
    }

    loadGlyphs(params: Object, callback: Function) {
        const key = JSON.stringify(params);
        if (this.glyphs[key]) {
            callback(null, this.glyphs[key]);
        } else {
            this.style.getGlyphs('', params, (err, glyphs) => {
                this.glyphs[key] = glyphs;
                callback(err, glyphs);
            });
        }
    }

    setup(): Promise<void> {
        const parser = this;
        this.actor = {
            send(action, params, callback) {
                setTimeout(() => {
                    if (action === 'getImages') {
                        parser.loadImages(params, callback);
                    } else if (action === 'getGlyphs') {
                        parser.loadGlyphs(params, callback);
                    } else assert(false);
                }, 0);
            }
        };

        return Promise.all([
            createStyle(this.styleJSON),
            fetchTileJSON(mapStub._requestManager, (this.styleJSON.sources[this.sourceID]: any).url)
        ]).then(([style: Style, tileJSON: TileJSON]) => {
            this.style = style;
            this.tileJSON = tileJSON;
        });
    }

    fetchTile(tileID: OverscaledTileID) {
        return fetch(this.style.map._requestManager.normalizeTileURL(tileID.canonical.url(this.tileJSON.tiles)))
            .then(response => response.arrayBuffer())
            .then(buffer => ({tileID, buffer}));
    }

    parseTile(tile: {tileID: OverscaledTileID, buffer: ArrayBuffer}, returnDependencies?: boolean): Promise<?WorkerTileResult> {
        const workerTile = new WorkerTile({
            tileID: tile.tileID,
            tileZoom: tile.tileID.overscaledZ,
            zoom: tile.tileID.overscaledZ,
            tileSize: 512,
            overscaling: 1,
            showCollisionBoxes: false,
            source: this.sourceID,
            uid: 0,
            maxZoom: 22,
            pixelRatio: 1,
            request: {url: ''},
            angle: 0,
            pitch: 0,
            cameraToCenterDistance: 0,
            cameraToTileDistance: 0,
            returnDependencies,
            promoteId: undefined,
            isSymbolTile: false
        });

        const vectorTile = new VT.VectorTile(new Protobuf(tile.buffer));

        return new Promise((resolve, reject) => {
            workerTile.parse(vectorTile, this.layerIndex, [], (this.actor: any), (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }
}
