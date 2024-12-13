import {renderIcon} from '../data/usvg/usvg_pb_renderer';
import {RGBAImage} from '../util/image';
import {LRUCache} from '../util/lru';
import {makeFQID} from '../util/fqid';

import type {ImageIdWithOptions} from '../style-spec/expression/types/image_id_with_options';
import type {Icon} from '../data/usvg/usvg_pb_decoder';
import type {StyleImage} from '../style/style_image';
import type {RasterizationOptions} from '../style-spec/expression/types/resolved_image';

const MAX_CACHE_SIZE = 150;

export class ImageRasterizer {
    cacheMap: Map<string, LRUCache<RGBAImage>>;
    cacheDependenciesMap: Map<string, Map<string, Set<string>>>;

    constructor() {
        this.cacheMap = new Map();
        this.cacheDependenciesMap = new Map();
    }

    static _getImage(imageData: ImageData): RGBAImage {
        return new RGBAImage(imageData, imageData.data);
    }

    getFromCache(imageIdWithOptions: ImageIdWithOptions, scope: string, mapId): RGBAImage | undefined {
        if (!this.cacheMap.has(mapId)) {
            this.cacheMap.set(mapId, new LRUCache(MAX_CACHE_SIZE));
        }

        return this.cacheMap.get(mapId).get(makeFQID(imageIdWithOptions.serialize(), scope));
    }

    setInCache(imageIdWithOptions: ImageIdWithOptions, image: RGBAImage, scope: string, mapId: string): void {
        if (!this.cacheDependenciesMap.has(mapId)) {
            this.cacheDependenciesMap.set(mapId, new Map());
        }

        if (!this.cacheMap.has(mapId)) {
            this.cacheMap.set(mapId, new LRUCache(MAX_CACHE_SIZE));
        }

        const cacheDependencies = this.cacheDependenciesMap.get(mapId);

        if (!cacheDependencies.get(makeFQID(imageIdWithOptions.id, scope))) {
            cacheDependencies.set(makeFQID(imageIdWithOptions.id, scope), new Set());
        }

        const cache = this.cacheMap.get(mapId);
        const serializedId = imageIdWithOptions.serialize();

        cacheDependencies.get(makeFQID(imageIdWithOptions.id, scope)).add(serializedId);
        cache.put(makeFQID(imageIdWithOptions.serialize(), scope), image);
    }

    removeImagesFromCacheByIds(ids: Array<string>, scope: string, mapId: string = ''): void {
        if (!this.cacheMap.has(mapId) || !this.cacheDependenciesMap.has(mapId)) {
            return;
        }

        const cache = this.cacheMap.get(mapId);
        const cacheDependencies = this.cacheDependenciesMap.get(mapId);
        for (const id of ids) {
            if (cacheDependencies.has(makeFQID(id, scope))) {
                for (const dependency of cacheDependencies.get(makeFQID(id, scope))) {
                    cache.delete(dependency);
                }
                cacheDependencies.delete(makeFQID(id, scope));
            }
        }
    }

    rasterize(imageIdWithOptions: ImageIdWithOptions, image: StyleImage, scope: string, mapId: string, rasterize: (icon: Icon, options: RasterizationOptions) => ImageData = renderIcon): RGBAImage {
        const cachedImage = this.getFromCache(imageIdWithOptions, scope, mapId);
        if (cachedImage) {
            return cachedImage.clone();
        }

        const imageData = rasterize(image.icon, imageIdWithOptions.options);
        const imageResult = ImageRasterizer._getImage(imageData);

        this.setInCache(imageIdWithOptions, imageResult, scope, mapId);

        return imageResult.clone();
    }
}
