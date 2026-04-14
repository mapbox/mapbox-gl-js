import {describe, test, expect, beforeEach} from '../../util/vitest';
import ImageAtlas, {ImageAtlasCache, ImageAtlasReference, sortImagesMap} from '../../../src/render/image_atlas';
import {AtlasContentDescriptor} from '../../../src/render/atlas_content_descriptor';
import {RGBAImage} from '../../../src/util/image';
import {ImageVariant} from '../../../src/style-spec/expression/types/image_variant';
import Color from '../../../src/style-spec/util/color';
import Context from '../../../src/gl/context';

import type {StyleImage, StyleImageMap} from '../../../src/style/style_image';
import type {StringifiedImageVariant} from '../../../src/style-spec/expression/types/image_variant';

// Helper to create a stringified image variant ID
function createImageVariantId(id: string, sx = 1, sy = 1): StringifiedImageVariant {
    return new ImageVariant(id, {sx, sy}).toString();
}

// Helper to create a mock StyleImage
function createMockImage(id: string, width = 16, height = 16, version = 1, usvg = false): StyleImage {
    return {
        data: new RGBAImage({width, height}),
        pixelRatio: 1,
        version,
        sdf: false,
        usvg,
        stretchX: undefined,
        stretchY: undefined,
        content: undefined,
        hasRenderCallback: false,
        width,
        height
    };
}

// Create a real WebGL context for testing
const el = window.document.createElement('canvas');
const gl = el.getContext('webgl2');
const context = new Context(gl);

describe('sortImagesMap', () => {
    test('sorts images by name', () => {
        const zebraId = createImageVariantId('zebra');
        const appleId = createImageVariantId('apple');
        const bananaId = createImageVariantId('banana');

        const images: StyleImageMap<StringifiedImageVariant> = new Map([
            [zebraId, createMockImage('zebra')],
            [appleId, createMockImage('apple')],
            [bananaId, createMockImage('banana')]
        ]);

        const sorted = sortImagesMap(images);
        const keys = Array.from(sorted.keys());

        expect(keys[0]).toEqual(appleId);
        expect(keys[1]).toEqual(bananaId);
        expect(keys[2]).toEqual(zebraId);
    });

    test('sorts images by scale factors when names match', () => {
        const icon1 = createImageVariantId('icon', 1, 1);
        const icon15 = createImageVariantId('icon', 1.5, 1.5);
        const icon2 = createImageVariantId('icon', 2, 2);

        const images: StyleImageMap<StringifiedImageVariant> = new Map([
            [icon2, createMockImage('icon')],
            [icon1, createMockImage('icon')],
            [icon15, createMockImage('icon')]
        ]);

        const sorted = sortImagesMap(images);
        const keys = Array.from(sorted.keys());

        expect(keys[0]).toEqual(icon1);
        expect(keys[1]).toEqual(icon15);
        expect(keys[2]).toEqual(icon2);
    });

    test('populates variant cache when provided', () => {
        const iconId = createImageVariantId('icon', 1, 1);
        const markerId = createImageVariantId('marker', 2, 2);

        const images: StyleImageMap<StringifiedImageVariant> = new Map([
            [iconId, createMockImage('icon')],
            [markerId, createMockImage('marker')]
        ]);
        const variantCache: Map<StringifiedImageVariant, ImageVariant> = new Map();

        sortImagesMap(images, variantCache);

        expect(variantCache.size).toEqual(2);
        expect(variantCache.has(iconId)).toBe(true);
        expect(variantCache.has(markerId)).toBe(true);
    });
});

describe('AtlasContentDescriptor', () => {
    test('creates descriptor with hash', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('pattern'), createMockImage('pattern')]]);
        const versions: Map<string, number> = new Map([['icon', 1], ['pattern', 1]]);

        const descriptor = new AtlasContentDescriptor(icons, patterns, versions, null);

        expect(descriptor.hash).toBeDefined();
        expect(typeof descriptor.hash).toEqual('number');
    });

    test('same content produces same hash', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('pattern'), createMockImage('pattern')]]);
        const versions: Map<string, number> = new Map([['icon', 1], ['pattern', 1]]);

        const descriptor1 = new AtlasContentDescriptor(icons, patterns, versions, null);
        const descriptor2 = new AtlasContentDescriptor(icons, patterns, versions, null);

        expect(descriptor1.hash).toEqual(descriptor2.hash);
    });

    test('different content produces different hash', () => {
        const icons1: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon1'), createMockImage('icon1')]]);
        const icons2: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon2'), createMockImage('icon2')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon1', 1], ['icon2', 1]]);

        const descriptor1 = new AtlasContentDescriptor(icons1, patterns, versions, null);
        const descriptor2 = new AtlasContentDescriptor(icons2, patterns, versions, null);

        expect(descriptor1.hash).not.toEqual(descriptor2.hash);
    });

    test('different versions produce different hash', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions1: Map<string, number> = new Map([['icon', 1]]);
        const versions2: Map<string, number> = new Map([['icon', 2]]);

        const descriptor1 = new AtlasContentDescriptor(icons, patterns, versions1, null);
        const descriptor2 = new AtlasContentDescriptor(icons, patterns, versions2, null);

        expect(descriptor1.hash).not.toEqual(descriptor2.hash);
    });

    test('sets requiresMipMaps when patterns are present', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('pattern'), createMockImage('pattern')]]);
        const versions: Map<string, number> = new Map([['icon', 1], ['pattern', 1]]);

        const descriptor = new AtlasContentDescriptor(icons, patterns, versions, null);

        expect(descriptor.requiresMipMaps).toBe(true);
    });

    test('requiresMipMaps is false when no patterns', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon', 1]]);

        const descriptor = new AtlasContentDescriptor(icons, patterns, versions, null);

        expect(descriptor.requiresMipMaps).toBe(false);
    });

    test('subsetOf returns true when content is subset', () => {
        const icons1: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon1'), createMockImage('icon1')]]);
        const icons2: StyleImageMap<StringifiedImageVariant> = new Map([
            [createImageVariantId('icon1'), createMockImage('icon1')],
            [createImageVariantId('icon2'), createMockImage('icon2')]
        ]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon1', 1], ['icon2', 1]]);

        const descriptor1 = new AtlasContentDescriptor(icons1, patterns, versions, null);
        const descriptor2 = new AtlasContentDescriptor(icons2, patterns, versions, null);

        expect(descriptor1.subsetOf(descriptor2)).toBe(true);
    });

    test('subsetOf returns false when content is not subset', () => {
        const icons1: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon1'), createMockImage('icon1')]]);
        const icons2: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon2'), createMockImage('icon2')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon1', 1], ['icon2', 1]]);

        const descriptor1 = new AtlasContentDescriptor(icons1, patterns, versions, null);
        const descriptor2 = new AtlasContentDescriptor(icons2, patterns, versions, null);

        expect(descriptor1.subsetOf(descriptor2)).toBe(false);
    });

    test('subsetOf early bailout when subset has more images', () => {
        const icons1: StyleImageMap<StringifiedImageVariant> = new Map([
            [createImageVariantId('icon1'), createMockImage('icon1')],
            [createImageVariantId('icon2'), createMockImage('icon2')]
        ]);
        const icons2: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon1'), createMockImage('icon1')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon1', 1], ['icon2', 1]]);

        const descriptor1 = new AtlasContentDescriptor(icons1, patterns, versions, null);
        const descriptor2 = new AtlasContentDescriptor(icons2, patterns, versions, null);

        // Should return false immediately without iterating
        expect(descriptor1.subsetOf(descriptor2)).toBe(false);
    });
});

describe('ImageAtlasCache', () => {
    let cache: ImageAtlasCache;

    beforeEach(() => {
        cache = new ImageAtlasCache();
    });

    test('findCachedAtlas returns undefined for empty cache', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon', 1]]);
        const descriptor = new AtlasContentDescriptor(icons, patterns, versions, null);

        const result = cache.findCachedAtlas(descriptor);

        expect(result).toBeUndefined();
    });

    test('findCachedAtlas finds exact match', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon', 1]]);
        const atlas = new ImageAtlas(icons, patterns, null, versions);

        // Cache the atlas
        cache.getOrCache(atlas);

        // Try to find it with same descriptor
        const descriptor = new AtlasContentDescriptor(icons, patterns, versions, null);
        const result = cache.findCachedAtlas(descriptor);

        expect(result).toBe(atlas);
    });

    test('findCachedAtlas finds subset match', () => {
        // Create atlas with multiple icons
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([
            [createImageVariantId('icon1'), createMockImage('icon1')],
            [createImageVariantId('icon2'), createMockImage('icon2')]
        ]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon1', 1], ['icon2', 1]]);
        const atlas = new ImageAtlas(icons, patterns, null, versions);

        // Cache the atlas
        cache.getOrCache(atlas);

        // Try to find it with subset descriptor (only icon1)
        const subsetIcons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon1'), createMockImage('icon1')]]);
        const descriptor = new AtlasContentDescriptor(subsetIcons, patterns, versions, null);
        const result = cache.findCachedAtlas(descriptor);

        expect(result).toBe(atlas);
    });

    test('getOrCache returns same atlas for duplicate content', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon', 1]]);

        const atlas1 = new ImageAtlas(icons, patterns, null, versions);
        const atlas2 = new ImageAtlas(icons, patterns, null, versions);

        const cached1 = cache.getOrCache(atlas1);
        const cached2 = cache.getOrCache(atlas2);

        expect(cached1).toBe(atlas1);
        expect(cached2).toBe(atlas1); // Should return first atlas, not second
    });

    test('getOrCache handles ImageAtlasReference', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon', 1]]);
        const atlas = new ImageAtlas(icons, patterns, null, versions);

        // Cache the atlas
        cache.getOrCache(atlas);

        // Create reference to cached atlas
        const reference = new ImageAtlasReference(atlas.contentDescriptor.hash);
        const result = cache.getOrCache(reference);

        expect(result).toBe(atlas);
    });

    test('getOrCache returns null for GC\'d atlas reference', () => {
        // Create a reference to a non-existent atlas
        const reference = new ImageAtlasReference(12345);
        const result = cache.getOrCache(reference);

        expect(result).toBeNull();
    });

    test('mipmap compatibility - no mipmaps requested can use atlas with mipmaps', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('pattern'), createMockImage('pattern')]]); // Has patterns = has mipmaps
        const versions: Map<string, number> = new Map([['icon', 1], ['pattern', 1]]);
        const atlas = new ImageAtlas(icons, patterns, null, versions);

        cache.getOrCache(atlas);

        // Request without patterns (no mipmaps needed)
        const descriptor = new AtlasContentDescriptor(icons, new Map(), versions, null);
        const result = cache.findCachedAtlas(descriptor);

        expect(result).toBe(atlas); // Should find it despite mipmap difference
    });

    test('mipmap compatibility - mipmaps requested cannot use atlas without mipmaps', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon', 1]]);
        const atlas = new ImageAtlas(icons, patterns, null, versions); // No patterns = no mipmaps

        cache.getOrCache(atlas);

        // Request with patterns (mipmaps needed)
        const patternsNeeded: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('pattern'), createMockImage('pattern')]]);
        const versionsWithPattern: Map<string, number> = new Map([['icon', 1], ['pattern', 1]]);
        const descriptor = new AtlasContentDescriptor(icons, patternsNeeded, versionsWithPattern, null);
        const result = cache.findCachedAtlas(descriptor);

        expect(result).toBeUndefined(); // Should NOT find it
    });

    test('getTextureForAtlas creates texture on first call', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon', 1]]);
        const atlas = new ImageAtlas(icons, patterns, null, versions);

        const texture = cache.getTextureForAtlas(atlas, context, context.gl.RGBA8);

        expect(texture).toBeDefined();
        expect(texture.texture).toBeDefined(); // Verify actual texture exists
    });

    test('getTextureForAtlas returns cached texture on subsequent calls', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon', 1]]);
        const atlas = new ImageAtlas(icons, patterns, null, versions);

        const texture1 = cache.getTextureForAtlas(atlas, context, context.gl.RGBA8);
        const texture2 = cache.getTextureForAtlas(atlas, context, context.gl.RGBA8);

        expect(texture1).toBe(texture2); // Same texture object returned
    });

    test('clear destroys all textures and clears cache', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon', 1]]);
        const atlas = new ImageAtlas(icons, patterns, null, versions);

        const texture = cache.getTextureForAtlas(atlas, context, context.gl.RGBA8);

        cache.clear();

        // After clear, should create new texture
        const newTexture = cache.getTextureForAtlas(atlas, context, context.gl.RGBA8);
        expect(newTexture).not.toBe(texture);

        // Atlas should not be in cache anymore
        const descriptor = new AtlasContentDescriptor(icons, patterns, versions, null);
        const cachedAtlas = cache.findCachedAtlas(descriptor);
        expect(cachedAtlas).toBeUndefined();
    });

    test('findCachedAtlas does not match atlas with same image names but different LUT-applied color params', () => {
        // Simulate the setImportColorTheme bug (GLJS-1673): old atlas was built with red-LUT colors (pink),
        // new tile re-parses with BW-LUT colors (grey). Same base image name "attraction",
        // but different color params — must NOT return the old atlas.
        const pinkColor = new Color(0.956, 0.482, 0.796, 1); // red-LUT applied
        const greyColor = new Color(0.651, 0.651, 0.651, 1); // BW-LUT applied

        const oldVariantId = new ImageVariant('attraction', {params: {background: pinkColor}}).toString();
        const newVariantId = new ImageVariant('attraction', {params: {background: greyColor}}).toString();

        const oldIcons: StyleImageMap<StringifiedImageVariant> = new Map([[oldVariantId, createMockImage('attraction')]]);
        const newIcons: StyleImageMap<StringifiedImageVariant> = new Map([[newVariantId, createMockImage('attraction')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['attraction', 1]]);

        // Cache atlas built with old (pink) params
        const oldAtlas = new ImageAtlas(oldIcons, patterns, null, versions);
        cache.getOrCache(oldAtlas);

        // New tile requests the same image name but with new (grey) params
        const newDescriptor = new AtlasContentDescriptor(newIcons, patterns, versions, null);
        const result = cache.findCachedAtlas(newDescriptor);

        expect(result).toBeUndefined();
    });

    test('destroyTextures preserves cache but destroys textures', () => {
        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon', 1]]);
        const atlas = new ImageAtlas(icons, patterns, null, versions);

        cache.getOrCache(atlas);
        const texture = cache.getTextureForAtlas(atlas, context, context.gl.RGBA8);

        cache.destroyTextures();

        // Atlas should still be in cache
        const descriptor = new AtlasContentDescriptor(icons, patterns, versions, null);
        const cachedAtlas = cache.findCachedAtlas(descriptor);
        expect(cachedAtlas).toBe(atlas);

        // But texture needs to be recreated
        const newTexture = cache.getTextureForAtlas(atlas, context, context.gl.RGBA8);
        expect(newTexture).not.toBe(texture);
    });
});

describe('ImageAtlasCache - LRU eviction', () => {
    test('resets atlas.uploaded to false when its texture is evicted', () => {
        // After GPU texture eviction, atlas.uploaded must be reset so
        // tiles re-upload on the next frame if needed
        const cache = new ImageAtlasCache({maxTextureMemoryMB: 0.001});

        const icons1: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon1'), createMockImage('icon1', 100, 100)]]);
        const icons2: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon2'), createMockImage('icon2', 100, 100)]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon1', 1], ['icon2', 1]]);

        const atlas1 = new ImageAtlas(icons1, patterns, null, versions);
        const atlas2 = new ImageAtlas(icons2, patterns, null, versions);

        // Simulate tile.upload() having already uploaded atlas1
        cache.getTextureForAtlas(atlas1, context, context.gl.RGBA8);
        atlas1.uploaded = true;

        // Uploading atlas2 exceeds the memory budget, forcing eviction of atlas1
        cache.getTextureForAtlas(atlas2, context, context.gl.RGBA8);

        // The eviction must reset atlas1.uploaded so tiles re-upload on the next frame
        expect(atlas1.uploaded).toBe(false);
    });

    test('evicts LRU texture when memory budget exceeded', () => {
        // Create cache with very small budget (1KB)
        const cache = new ImageAtlasCache({maxTextureMemoryMB: 0.001});

        const icons1: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon1'), createMockImage('icon1', 100, 100)]]);
        const icons2: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon2'), createMockImage('icon2', 100, 100)]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon1', 1], ['icon2', 1]]);

        const atlas1 = new ImageAtlas(icons1, patterns, null, versions);
        const atlas2 = new ImageAtlas(icons2, patterns, null, versions);

        // Create first texture
        const texture1 = cache.getTextureForAtlas(atlas1, context, context.gl.RGBA8);
        expect(texture1).toBeDefined();

        // Create second texture - should evict first due to memory budget
        const texture2 = cache.getTextureForAtlas(atlas2, context, context.gl.RGBA8);
        expect(texture2).toBeDefined();

        // If we request texture1 again, it should be a new texture (indicating eviction)
        const newTexture1 = cache.getTextureForAtlas(atlas1, context, context.gl.RGBA8);
        expect(newTexture1).not.toBe(texture1);
    });

    test('LRU eviction with access tracking', () => {
        // Use budget that fits 2 textures comfortably
        // 30x30 RGBA = 3.6KB each
        const cache = new ImageAtlasCache({maxTextureMemoryMB: 0.01});

        const icons1: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon1'), createMockImage('icon1', 30, 30)]]);
        const icons2: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon2'), createMockImage('icon2', 30, 30)]]);
        const icons3: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon3'), createMockImage('icon3', 30, 30)]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon1', 1], ['icon2', 1], ['icon3', 1]]);

        const atlas1 = new ImageAtlas(icons1, patterns, null, versions);
        const atlas2 = new ImageAtlas(icons2, patterns, null, versions);
        const atlas3 = new ImageAtlas(icons3, patterns, null, versions);

        const texture1 = cache.getTextureForAtlas(atlas1, context, context.gl.RGBA8);
        const texture2 = cache.getTextureForAtlas(atlas2, context, context.gl.RGBA8);

        // Verify both are cached
        expect(cache.getTextureForAtlas(atlas1, context, context.gl.RGBA8)).toBe(texture1);
        expect(cache.getTextureForAtlas(atlas2, context, context.gl.RGBA8)).toBe(texture2);

        // Create texture3 - should trigger eviction due to memory constraints
        const texture3 = cache.getTextureForAtlas(atlas3, context, context.gl.RGBA8);
        expect(texture3).toBeDefined();

        // At least one of texture1 or texture2 should have been evicted
        const newTexture1 = cache.getTextureForAtlas(atlas1, context, context.gl.RGBA8);
        const newTexture2 = cache.getTextureForAtlas(atlas2, context, context.gl.RGBA8);
        const evicted = newTexture1 !== texture1 || newTexture2 !== texture2;
        expect(evicted).toBe(true);
    });
});

describe('ImageAtlasCache - version invalidation', () => {
    test('different version prevents cache hit', () => {
        const cache = new ImageAtlasCache();

        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon')]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions1: Map<string, number> = new Map([['icon', 1]]);
        const versions2: Map<string, number> = new Map([['icon', 2]]);

        const atlas1 = new ImageAtlas(icons, patterns, null, versions1);
        cache.getOrCache(atlas1);

        // Try to find with different version
        const descriptor = new AtlasContentDescriptor(icons, patterns, versions2, null);
        const result = cache.findCachedAtlas(descriptor);

        expect(result).toBeUndefined();
    });

    test('same version after image update allows cache hit', () => {
        const cache = new ImageAtlasCache();

        const icons: StyleImageMap<StringifiedImageVariant> = new Map([[createImageVariantId('icon'), createMockImage('icon', 16, 16, 1)]]);
        const patterns: StyleImageMap<StringifiedImageVariant> = new Map();
        const versions: Map<string, number> = new Map([['icon', 1]]);

        const atlas = new ImageAtlas(icons, patterns, null, versions);
        cache.getOrCache(atlas);

        // Create new atlas with same version (shouldn't happen in practice, but tests cache behavior)
        const descriptor = new AtlasContentDescriptor(icons, patterns, versions, null);
        const result = cache.findCachedAtlas(descriptor);

        expect(result).toBe(atlas);
    });
});
