import RasterArrayTileSource from '../source/raster_array_tile_source';
import {ImageId} from '../style-spec/expression/types/image_id';

import type SourceCache from '../source/source_cache';
import type RasterArrayTile from '../source/raster_array_tile';
import type {StyleImage, StyleImageMap} from '../style/style_image';

export class ImageProvider {
    id: string;
    scope: string;
    sourceCache: SourceCache;
    pendingRequests: Set<string>;
    missingRequests: Set<string>;

    constructor(id: string, scope: string, sourceCache: SourceCache) {
        this.id = id;
        this.scope = scope;
        this.sourceCache = sourceCache;
        this.pendingRequests = new Set();
        this.missingRequests = new Set();
    }

    addPendingRequest(imageId: ImageId) {
        // Don't add the request if it has already been marked as missing
        if (this.missingRequests.has(imageId.name)) return;

        if (!this.pendingRequests.has(imageId.name)) {
            this.pendingRequests.add(imageId.name);
        }
    }

    hasPendingRequests() {
        return this.pendingRequests.size > 0;
    }

    /**
     * Resolves pending image requests by extracting image data from visible tiles.
     * Called during the Map's render cycle to process image requests that were
     * added through addPendingRequest(). Supports only `RasterArrayTileSource`.
     * @returns {StyleImageMap<ImageId>} Map of resolved image requests
     */
    resolvePendingRequests(): StyleImageMap<ImageId> {
        const styleImages = new Map<ImageId, StyleImage>();

        // Don't resolve pending requests until all tiles are loaded
        if (!this.sourceCache.loaded()) return styleImages;

        const tileIDs = this.sourceCache.getVisibleCoordinates();

        // If there are no visible tiles, then tiles have not been requested yet
        if (tileIDs.length === 0) return styleImages;

        // Only RasterArrayTileSource is supported
        const source = this.sourceCache.getSource();
        if (!(source instanceof RasterArrayTileSource)) return styleImages;

        const tiles = tileIDs.map(tileID => this.sourceCache.getTile(tileID) as RasterArrayTile);
        const images = source.getImages(tiles, Array.from(this.pendingRequests));

        for (const [name, styleImage] of images) {
            styleImages.set(ImageId.from({name, iconsetId: this.id}), styleImage);
            this.pendingRequests.delete(name);
        }

        // If some requests are still pending, it means that the requested images are not available within the current tile coverage.
        for (const imageId of this.pendingRequests) {
            this.missingRequests.add(imageId);
        }

        this.pendingRequests.clear();
        return styleImages;
    }
}
