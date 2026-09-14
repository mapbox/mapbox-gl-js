import {PMTiles, FetchSource, SharedPromiseCache} from 'pmtiles';

import type {TileJSON, TileDataResponse, TileProvider, VectorSourceSpecification, RequestParameters} from 'mapbox-gl';

/**
 * PMTiles tile provider implementation.
 *
 * @private
 */
export default class PMTilesProvider implements TileProvider<ArrayBuffer> {
    private readonly url: string;
    private readonly cache = new SharedPromiseCache();

    constructor(options: VectorSourceSpecification) {
        if (!options.url) throw new Error('PMTilesProvider requires a source url');
        this.url = options.url;
    }

    private getPMTiles(request: RequestParameters): PMTiles {
        if (!request.credentials && !Object.keys(request.headers || {}).length) {
            return new PMTiles(this.url, this.cache);
        }

        const headers = new Headers(request.headers);
        const source = new FetchSource(this.url, headers, request.credentials);
        return new PMTiles(source, this.cache);
    }

    async load(options: {request: RequestParameters}): Promise<TileJSON> {
        // PMTiles reads TileJSON from the archive header via byte-range requests,
        // so we use this.url directly instead of options.request.url.
        return await this.getPMTiles(options.request).getTileJson(this.url) as TileJSON;
    }

    async loadTile(tile: {z: number; x: number; y: number}, options: {request: RequestParameters; signal: AbortSignal}): Promise<TileDataResponse<ArrayBuffer> | null> {
        const response = await this.getPMTiles(options.request).getZxy(tile.z, tile.x, tile.y, options.signal);
        if (!response) return null;

        return {
            data: response.data,
            expires: response.expires,
            cacheControl: response.cacheControl,
        };
    }
}
