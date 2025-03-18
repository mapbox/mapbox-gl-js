import {renderIcon} from '../data/usvg/usvg_pb_renderer';
import {RGBAImage} from '../util/image';
import {LRUCache} from '../util/lru';
import {makeFQID} from '../util/fqid';

import type {Icon} from '../data/usvg/usvg_pb_decoder';
import type {StyleImage} from '../style/style_image';
import type {ImageVariant, RasterizationOptions} from '../style-spec/expression/types/image_variant';

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

    getFromCache(imageVariant: ImageVariant, scope: string, mapId): RGBAImage | undefined {
        if (!this.cacheMap.has(mapId)) {
            this.cacheMap.set(mapId, new LRUCache(MAX_CACHE_SIZE));
        }

        return this.cacheMap.get(mapId).get(makeFQID(imageVariant.serialize(), scope));
    }

    setInCache(imageVariant: ImageVariant, image: RGBAImage, scope: string, mapId: string): void {
        if (!this.cacheDependenciesMap.has(mapId)) {
            this.cacheDependenciesMap.set(mapId, new Map());
        }

        if (!this.cacheMap.has(mapId)) {
            this.cacheMap.set(mapId, new LRUCache(MAX_CACHE_SIZE));
        }

        const cacheDependencies = this.cacheDependenciesMap.get(mapId);

        const imageVariantId = imageVariant.serializeId();
        if (!cacheDependencies.get(makeFQID(imageVariantId, scope))) {
            cacheDependencies.set(makeFQID(imageVariantId, scope), new Set());
        }

        const cache = this.cacheMap.get(mapId);
        const serializedId = imageVariant.serialize();

        cacheDependencies.get(makeFQID(imageVariantId, scope)).add(serializedId);
        cache.put(makeFQID(imageVariant.serialize(), scope), image);
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

    rasterize(imageVariant: ImageVariant, image: StyleImage, scope: string, mapId: string, rasterize: (icon: Icon, options: RasterizationOptions) => ImageData = renderIcon): RGBAImage {
        const cachedImage = this.getFromCache(imageVariant, scope, mapId);
        if (cachedImage) {
            return cachedImage.clone();
        }

        const imageData = rasterize(image.icon, imageVariant.options);
        const imageResult = ImageRasterizer._getImage(imageData);

        this.setInCache(imageVariant, imageResult, scope, mapId);

        return imageResult.clone();
    }
}
