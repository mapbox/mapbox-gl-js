import assert from 'assert';
import {RGBAImage} from '../util/image';
import {register} from '../util/web_worker_transfer';
import {warnOnce} from '../util/util';
import potpack from 'potpack';
import {ImageId} from '../style-spec/expression/types/image_id';
import {ImageVariant} from '../style-spec/expression/types/image_variant';
import {AtlasContentDescriptor, type ImageVersionsMap} from './atlas_content_descriptor';
import Texture from './texture';

import type {StyleImage, StyleImageMap} from '../style/style_image';
import type ImageManager from './image_manager';
import type {SpritePosition} from '../util/image';
import type {LUT} from "../util/lut";
import type {StringifiedImageVariant} from '../style-spec/expression/types/image_variant';
import type Context from '../gl/context';
import type {TextureFormat} from './texture';

const ICON_PADDING: number = 1;
const PATTERN_PADDING: number = 2;
export {ICON_PADDING, PATTERN_PADDING};

type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};

type ImagePositionScale = {
    x: number;
    y: number;
};

export type ImagePositionMap = Map<StringifiedImageVariant, ImagePosition>;

export class ImagePosition implements SpritePosition {
    paddedRect: Rect;
    pixelRatio: number;
    version: number;
    stretchY: Array<[number, number]> | null | undefined;
    stretchX: Array<[number, number]> | null | undefined;
    content: [number, number, number, number] | null | undefined;
    padding: number;
    sdf: boolean;
    usvg: boolean;
    scale: ImagePositionScale;

    static getImagePositionScale(imageVariant: ImageVariant | undefined, usvg: boolean, pixelRatio: number): ImagePositionScale {
        if (usvg && imageVariant) {
            const {sx, sy} = imageVariant;
            return {
                x: sx,
                y: sy
            };
        } else {
            return {
                x: pixelRatio,
                y: pixelRatio
            };
        }
    }

    constructor(paddedRect: Rect, image: StyleImage, padding: number, imageVariant?: ImageVariant) {
        this.paddedRect = paddedRect;
        const {
            pixelRatio,
            version,
            stretchX,
            stretchY,
            content,
            sdf,
            usvg,
        } = image;

        this.pixelRatio = pixelRatio;
        this.stretchX = stretchX;
        this.stretchY = stretchY;
        this.content = content;
        this.version = version;
        this.padding = padding;
        this.sdf = sdf;
        this.usvg = usvg;
        this.scale = ImagePosition.getImagePositionScale(imageVariant, usvg, pixelRatio);
    }

    get tl(): [number, number] {
        return [
            this.paddedRect.x + this.padding,
            this.paddedRect.y + this.padding
        ];
    }

    get br(): [number, number] {
        return [
            this.paddedRect.x + this.paddedRect.w - this.padding,
            this.paddedRect.y + this.paddedRect.h - this.padding
        ];
    }

    get displaySize(): [number, number] {
        return [
            (this.paddedRect.w - this.padding * 2) / this.scale.x,
            (this.paddedRect.h - this.padding * 2) / this.scale.y
        ];
    }
}

function getImageBin(image: StyleImage, padding: number, scale: [number, number] = [1, 1]) {
    // If it's a vector image, we set it's size as the natural one scaled
    const imageWidth = image.data ? image.data.width : image.width * scale[0];
    const imageHeight = image.data ? image.data.height : image.height * scale[1];
    return {
        x: 0,
        y: 0,
        w: imageWidth + 2 * padding,
        h: imageHeight + 2 * padding,
    };
}

export function getImagePosition(id: StringifiedImageVariant, src: StyleImage, padding: number) {
    const imageVariant = ImageVariant.parse(id);
    const bin = getImageBin(src, padding, [imageVariant.sx, imageVariant.sy]);
    return {bin, imagePosition: new ImagePosition(bin, src, padding, imageVariant), imageVariant};
}

/**
 * Sorts images deterministically by name and scale for consistent atlas packing.
 * Used by worker threads to sort images before checking atlas cache.
 * Optionally populates variantCache to avoid re-parsing variants later.
 */
export function sortImagesMap(
    images: StyleImageMap<StringifiedImageVariant>,
    variantCache?: Map<StringifiedImageVariant, ImageVariant>
): StyleImageMap<StringifiedImageVariant> {
    type ParsedEntry = {
        key: StringifiedImageVariant;
        value: StyleImage;
        variant: ImageVariant;
    };

    const entries: ParsedEntry[] = [];
    for (const [key, value] of images.entries()) {
        const variant = ImageVariant.parse(key);
        if (variant) {
            entries.push({key, value, variant});
            // Populate cache while parsing for sorting
            if (variantCache) {
                variantCache.set(key, variant);
            }
        }
    }

    // Sort using pre-parsed variants
    entries.sort((a, b) => {
        // Sort by image name first
        const nameCompare = a.variant.id.toString().localeCompare(b.variant.id.toString());
        if (nameCompare !== 0) return nameCompare;

        // Same name, compare scale factors
        if (a.variant.sx !== b.variant.sx) return a.variant.sx - b.variant.sx;
        if (a.variant.sy !== b.variant.sy) return a.variant.sy - b.variant.sy;

        return 0;
    });

    const sorted = new Map<StringifiedImageVariant, StyleImage>();
    for (const entry of entries) {
        sorted.set(entry.key, entry.value);
    }
    return sorted;
}

/**
 * Lightweight reference to a cached atlas on main thread.
 * Worker sends this instead of full atlas when main thread already has it cached.
 */
export class ImageAtlasReference {
    sourceAtlasHash: number;

    constructor(sourceAtlasHash: number) {
        this.sourceAtlasHash = sourceAtlasHash;
    }
}

export default class ImageAtlas {
    image: RGBAImage;
    iconPositions: ImagePositionMap;
    patternPositions: ImagePositionMap;
    haveRenderCallbacks: ImageId[];
    uploaded: boolean | null | undefined;
    lut: LUT | null;
    contentDescriptor: AtlasContentDescriptor | null | undefined;

    constructor(icons: StyleImageMap<StringifiedImageVariant>, patterns: StyleImageMap<StringifiedImageVariant>, lut: LUT | null, imageVersions?: ImageVersionsMap) {
        const iconPositions: ImagePositionMap = new Map();
        const patternPositions: ImagePositionMap = new Map();
        this.haveRenderCallbacks = [];

        const bins = [];

        const enableAtlasCaching = imageVersions !== undefined;

        // Cache parsed variants to avoid re-parsing in AtlasContentDescriptor
        // sortImagesMap will populate this cache while sorting
        const variantCache = enableAtlasCaching ? new Map<StringifiedImageVariant, ImageVariant>() : undefined;

        const sortedIcons = enableAtlasCaching ? sortImagesMap(icons, variantCache) : icons;
        const sortedPatterns = enableAtlasCaching ? sortImagesMap(patterns, variantCache) : patterns;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.addImages(sortedIcons, iconPositions, ICON_PADDING, bins);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.addImages(sortedPatterns, patternPositions, PATTERN_PADDING, bins);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const {w, h} = potpack(bins);
        const image = new RGBAImage({width: w || 1, height: h || 1});

        for (const [id, src] of sortedIcons.entries()) {
            const bin = iconPositions.get(id).paddedRect;
            // For SDF icons, we override the RGB channels with white.
            // This is because we read the red channel in the shader and RGB channels will get alpha-premultiplied on upload.
            const overrideRGB = src.sdf;
            // We don't use the LUT here because it's applied on the GPU
            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x: bin.x + ICON_PADDING, y: bin.y + ICON_PADDING}, src.data, null, overrideRGB);
        }

        for (const [id, src] of sortedPatterns.entries()) {
            const patternPosition = patternPositions.get(id);
            const bin = patternPosition.paddedRect;
            let padding = patternPosition.padding;
            const x = bin.x + padding,
                y = bin.y + padding,
                w = src.data.width,
                h = src.data.height;

            assert(padding > 1);
            padding = padding > 1 ? padding - 1 : padding;

            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x, y}, src.data, lut);
            // Add wrapped padding on each side of the image.
            // Leave one pixel transparent to avoid bleeding to neighbouring images
            RGBAImage.copy(src.data, image, {x: 0, y: h - padding}, {x, y: y - padding}, {width: w, height: padding}, lut); // T
            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x, y: y + h}, {width: w, height: padding}, lut); // B
            RGBAImage.copy(src.data, image, {x: w - padding, y: 0}, {x: x - padding, y}, {width: padding, height: h}, lut); // L
            RGBAImage.copy(src.data, image, {x: 0,     y: 0}, {x: x + w, y}, {width: padding, height: h}, lut); // R
            // Fill corners
            RGBAImage.copy(src.data, image, {x: w - padding, y: h - padding}, {x: x - padding, y: y - padding}, {width: padding, height: padding}, lut); // TL
            RGBAImage.copy(src.data, image, {x: 0, y: h - padding}, {x: x + w, y: y - padding}, {width: padding, height: padding}, lut); // TR
            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x: x + w, y: y + h}, {width: padding, height: padding}, lut); // BL
            RGBAImage.copy(src.data, image, {x: w - padding, y: 0}, {x: x - padding, y: y + h}, {width: padding, height: padding}, lut); // BR
        }

        this.lut = lut;
        this.image = image;
        this.iconPositions = iconPositions;
        this.patternPositions = patternPositions;

        // Create content descriptor if atlas caching is enabled
        if (enableAtlasCaching) {
            this.contentDescriptor = new AtlasContentDescriptor(sortedIcons, sortedPatterns, imageVersions, lut, variantCache);
        }
    }

    addImages(images: StyleImageMap<StringifiedImageVariant>, positions: ImagePositionMap, padding: number, bins: Array<Rect>) {
        for (const [id, src] of images.entries()) {
            const {bin, imagePosition, imageVariant} = getImagePosition(id, src, padding);
            positions.set(id, imagePosition);
            bins.push(bin);

            if (src.hasRenderCallback) {
                this.haveRenderCallbacks.push(imageVariant.id);
            }
        }
    }

    patchUpdatedImages(imageManager: ImageManager, texture: Texture, scope: string, lut?: LUT | null) {
        this.haveRenderCallbacks = this.haveRenderCallbacks.filter(id => imageManager.hasImage(id, scope));
        imageManager.dispatchRenderCallbacks(this.haveRenderCallbacks, scope);

        for (const imageId of imageManager.getUpdatedImages(scope)) {
            for (const id of this.iconPositions.keys()) {
                const imageVariant = ImageVariant.parse(id);
                if (ImageId.isEqual(imageVariant.id, imageId)) {
                    const image = imageManager.getImage(imageId, scope);
                    // We don't use the LUT here because it's applied on the GPU
                    this.patchUpdatedImage(this.iconPositions.get(id), image, texture, null);
                }
            }

            for (const id of this.patternPositions.keys()) {
                const imageVariant = ImageVariant.parse(id);
                if (ImageId.isEqual(imageVariant.id, imageId)) {
                    const image = imageManager.getImage(imageId, scope);
                    this.patchUpdatedImage(this.patternPositions.get(id), image, texture, lut || this.lut);
                }
            }
        }
    }

    patchUpdatedImage(position: ImagePosition | null | undefined, image: StyleImage | null | undefined, texture: Texture, lut: LUT | null = null) {
        if (!position || !image) return;

        if (position.version === image.version) return;

        position.version = image.version;
        const [x, y] = position.tl;
        const overrideRGBWithWhite = position.sdf;
        if (this.lut || overrideRGBWithWhite) {
            const size = {width: image.data.width, height: image.data.height};
            const imageToUpload = new RGBAImage(size);
            RGBAImage.copy(image.data, imageToUpload, {x: 0, y: 0}, {x: 0, y: 0}, size, lut, overrideRGBWithWhite);
            texture.update(imageToUpload, {position: {x, y}, recreateWhenResize: false});
        } else {
            texture.update(image.data, {position: {x, y}, recreateWhenResize: false});
        }
    }

}

export class ImageAtlasCache {
    private cache: Map<number, WeakRef<ImageAtlas>>;
    private finalizationRegistry: FinalizationRegistry<number>;
    private textures: Map<ImageAtlas, Texture>;
    private textureAccessTimes: Map<ImageAtlas, number>;
    private textureMemoryUsed: number;
    private maxTextureMemory: number;

    constructor(options?: {maxTextureMemoryMB?: number}) {
        this.cache = new Map();
        this.textures = new Map();
        this.textureAccessTimes = new Map();
        this.textureMemoryUsed = 0;
        this.maxTextureMemory = (options && options.maxTextureMemoryMB ? options.maxTextureMemoryMB : 256) * 1024 * 1024;
        // Use FinalizationRegistry to clean up cache entries when atlases are garbage collected
        this.finalizationRegistry = new FinalizationRegistry((hash) => {
            this.cache.delete(hash);
            this.clearExpiredTextures();
        });
    }

    /**
     * Calculates GPU memory usage for an atlas texture.
     * Includes base texture memory and mipmap overhead.
     */
    private calculateTextureMemory(atlas: ImageAtlas): number {
        if (!atlas.image) return 0;

        const width = atlas.image.width;
        const height = atlas.image.height;
        const bytesPerPixel = 4; // RGBA8
        const baseMemory = width * height * bytesPerPixel;

        // If mipmaps are used, they add ~33% more memory (geometric series: 1 + 1/4 + 1/16 + ... ≈ 1.33)
        const hasMipmaps = atlas.patternPositions.size > 0;
        const mipmapMultiplier = hasMipmaps ? 1.33 : 1;

        return Math.ceil(baseMemory * mipmapMultiplier);
    }

    /**
     * Evicts a specific texture from the cache to free GPU memory.
     * The atlas remains in the CPU cache and can have its texture recreated later.
     */
    private evictTexture(atlas: ImageAtlas) {
        const texture = this.textures.get(atlas);
        if (texture) {
            const memory = this.calculateTextureMemory(atlas);
            texture.destroy();
            this.textures.delete(atlas);
            this.textureAccessTimes.delete(atlas);
            this.textureMemoryUsed -= memory;
            atlas.uploaded = false;
        }
    }

    /**
     * Evicts least recently used textures until enough memory is available.
     * Uses LRU (Least Recently Used) eviction policy based on textureAccessTimes.
     */
    private evictTexturesIfNeeded(requiredMemory: number) {
        while (this.textureMemoryUsed + requiredMemory > this.maxTextureMemory && this.textures.size > 0) {
            // Find least recently used texture
            let lruAtlas: ImageAtlas | null = null;
            let oldestTime = Infinity;

            for (const [atlas,] of this.textures.entries()) {
                const accessTime = this.textureAccessTimes.get(atlas) || 0;
                if (accessTime < oldestTime) {
                    oldestTime = accessTime;
                    lruAtlas = atlas;
                }
            }

            if (lruAtlas) {
                this.evictTexture(lruAtlas);
            } else {
                // No texture found to evict, break to avoid infinite loop
                break;
            }
        }
    }

    /**
     * Finds a cached atlas matching the given descriptor (exact or subset match).
     * Returns the cached atlas if found, undefined otherwise.
     */
    findCachedAtlas(descriptor: AtlasContentDescriptor): ImageAtlas | undefined {
        const hash = descriptor.hash;

        // Check for exact match
        const cachedRef = this.cache.get(hash);
        if (cachedRef) {
            const cachedAtlas = cachedRef.deref();
            if (cachedAtlas && cachedAtlas.contentDescriptor &&
                this.isMipmapCompatible(descriptor, cachedAtlas.contentDescriptor)) {
                return cachedAtlas;
            }
        }

        // Check for subset match
        for (const [, ref] of this.cache.entries()) {
            const cachedAtlas = ref.deref();
            if (cachedAtlas && cachedAtlas.contentDescriptor) {
                const isSubset = descriptor.subsetOf(cachedAtlas.contentDescriptor);
                const isMipCompatible = this.isMipmapCompatible(descriptor, cachedAtlas.contentDescriptor);
                if (isSubset && isMipCompatible) {
                    return cachedAtlas;
                }
            }
        }

        return undefined;
    }

    /**
     * Gets or creates a texture for the given atlas.
     * Multiple tiles sharing the same atlas will share the same texture.
     * Uses LRU eviction to stay within GPU memory budget.
     */
    getTextureForAtlas(atlas: ImageAtlas, context: Context, format: TextureFormat): Texture | null {
        // Update access time for LRU tracking
        this.textureAccessTimes.set(atlas, performance.now());

        // Check if we already have a texture for this atlas
        let texture = this.textures.get(atlas);
        if (texture) {
            return texture;
        }

        // Create or recreate texture for this atlas
        if (atlas.image) {
            const textureMemory = this.calculateTextureMemory(atlas);

            // Evict LRU textures if needed to stay within budget
            this.evictTexturesIfNeeded(textureMemory);

            const hasPattern = !!atlas.patternPositions.size;
            texture = new Texture(context, atlas.image, format, {useMipmap: hasPattern});
            this.textures.set(atlas, texture);
            this.textureMemoryUsed += textureMemory;

            // Note: We keep atlas.image around (unlike GL Native) because:
            // 1. WebGL context restoration requires image data to recreate textures
            // 2. Layout property changes may trigger new tile uploads
            // 3. LRU eviction allows texture recreation when needed
            return texture;
        }

        return null;
    }

    /**
     * Clears textures for atlases that no longer exist.
     */
    private clearExpiredTextures() {
        for (const [atlas,] of this.textures.entries()) {
            // If the atlas is no longer referenced, remove its texture
            if (!this.isAtlasCached(atlas)) {
                const texture = this.textures.get(atlas);
                if (texture) {
                    const memory = this.calculateTextureMemory(atlas);
                    texture.destroy();
                    this.textureMemoryUsed -= memory;
                }
                this.textures.delete(atlas);
                this.textureAccessTimes.delete(atlas);
            }
        }
    }

    private isAtlasCached(atlas: ImageAtlas): boolean {
        // O(1) lookup using hash instead of O(N) scan
        if (!atlas.contentDescriptor) return false;
        const ref = this.cache.get(atlas.contentDescriptor.hash);
        if (!ref) return false;
        const cachedAtlas = ref.deref();
        return cachedAtlas === atlas;
    }

    /**
     * Adds an atlas to the cache or returns an existing one with the same content.
     * @param atlas The atlas or reference to cache
     * @returns The cached atlas with image data
     */
    getOrCache(atlas: ImageAtlas | ImageAtlasReference): ImageAtlas | null {
        // If this is an ImageAtlasReference (from worker when cache hit),
        // look up and return the source atlas
        // Use property check instead of instanceof to avoid cross-context issues on Windows
        if (!('image' in atlas)) {
            const sourceRef = this.cache.get(atlas.sourceAtlasHash);
            if (sourceRef) {
                const sourceAtlas = sourceRef.deref();
                if (sourceAtlas) {
                    return sourceAtlas;
                }
            }
            // Atlas was GC'd - this shouldn't happen in normal operation
            // Worker should have received positions from a cached atlas that still exists
            warnOnce('ImageAtlasReference points to GC\'d atlas - atlas may have been evicted');
            return null;
        }

        if (!atlas.contentDescriptor) {
            // No content descriptor means this atlas can't be cached
            return atlas;
        }

        const descriptor = atlas.contentDescriptor;
        const hash = descriptor.hash;

        // Check for exact match
        const cachedRef = this.cache.get(hash);
        if (cachedRef) {
            const cachedAtlas = cachedRef.deref();
            if (cachedAtlas && cachedAtlas.contentDescriptor &&
                this.isMipmapCompatible(descriptor, cachedAtlas.contentDescriptor)) {
                return cachedAtlas;
            }
        }

        // IMPORTANT: Do NOT do subset matching here!
        // Subset matching can only work if the worker already reconciled positions.
        // If the worker created a fresh atlas, its buckets have UVs matching THIS atlas's layout.
        // Substituting a different atlas would break UV coordinates.
        // Subset matching only happens during worker's checkAtlasCache phase.

        // No match found, add to cache
        // At this point, atlas is guaranteed to be ImageAtlas (ImageAtlasReference was handled above)
        this.cache.set(hash, new WeakRef(atlas));
        this.finalizationRegistry.register(atlas, hash, atlas);
        return atlas;
    }

    /**
     * Checks if two atlases are compatible regarding mipmap requirements.
     * A cached atlas can be reused only if:
     * - The new atlas doesn't need mipmaps, OR
     * - The cached atlas has mipmaps
     */
    private isMipmapCompatible(newDescriptor: AtlasContentDescriptor, cachedDescriptor: AtlasContentDescriptor): boolean {
        return !newDescriptor.requiresMipMaps || cachedDescriptor.requiresMipMaps;
    }

    /**
     * Destroys all cached textures (e.g., during WebGL context restoration).
     * Atlas cache entries are preserved so textures can be recreated.
     */
    destroyTextures() {
        for (const texture of this.textures.values()) {
            if (texture) {
                texture.destroy();
            }
        }
        this.textures.clear();
        this.textureAccessTimes.clear();
        this.textureMemoryUsed = 0;
    }

    /**
     * Clears the entire cache, including textures and tracking data.
     */
    clear() {
        // Destroy all textures first
        for (const texture of this.textures.values()) {
            if (texture) {
                texture.destroy();
            }
        }

        // Clear all caches and tracking
        this.cache.clear();
        this.textures.clear();
        this.textureAccessTimes.clear();
        this.textureMemoryUsed = 0;
    }
}

register(ImagePosition, 'ImagePosition');
register(ImageAtlas, 'ImageAtlas', {omit: ['lut']});
register(ImageAtlasReference, 'ImageAtlasReference');
