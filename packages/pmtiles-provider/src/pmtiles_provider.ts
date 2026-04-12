import {PMTiles} from 'pmtiles';

import type {TileJSON, TileDataResponse, TileProvider, VectorSourceSpecification} from 'mapbox-gl';

/**
 * PMTiles tile provider implementation.
 *
 * @private
 */
export default class PMTilesProvider implements TileProvider<ArrayBuffer> {
    private url: string;
    private pmtiles: PMTiles;

    constructor(options: VectorSourceSpecification) {
        if (!options.url) throw new Error('PMTilesProvider requires a source url');
        this.url = options.url;
        this.pmtiles = new PMTiles(this.url);
    }

    async load(): Promise<TileJSON> {
        // PMTiles reads TileJSON from the archive header via byte-range requests,
        // so we use this.url directly instead of options.request.url.
        return await this.pmtiles.getTileJson(this.url) as TileJSON;
    }

    async loadTile(tile: {z: number; x: number; y: number}, options: {signal: AbortSignal}): Promise<TileDataResponse<ArrayBuffer> | null> {
        const response = await this.pmtiles.getZxy(tile.z, tile.x, tile.y, options.signal);
        if (!response) return null;

        return {
            data: response.data,
            expires: response.expires,
            cacheControl: response.cacheControl,
        };
    }
}
