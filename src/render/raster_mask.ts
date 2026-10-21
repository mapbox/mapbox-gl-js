import DepthMode from '../gl/depth_mode';
import StencilMode, {STENCIL_MASK_BIT} from '../gl/stencil_mode';
import ColorMode from '../gl/color_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {clippingMaskUniformValues} from './program/clipping_mask_program';
import {makeFQID} from '../util/fqid';
import {warnOnce} from '../util/util';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type FillBucket from '../data/bucket/fill_bucket';
import type FillStyleLayer from '../style/style_layer/fill_style_layer';
import type RasterStyleLayer from '../style/style_layer/raster_style_layer';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type {OverscaledTileID} from '../source/tile_id';
import type Tile from '../source/tile';

/**
 * `raster-mask` clips a raster layer to the polygons of another (`fill`) layer, without
 * modifying that layer or requiring the raster layer to be reordered.
 *
 * Implementation notes
 * --------------------
 * The mask is a single bit (`STENCIL_MASK_BIT`, the high bit) of the 8-bit stencil buffer,
 * which encodes "do not draw here". This works without touching any shader because GL's
 * stencil test compares `(ref & mask) FUNC (stencil & mask)` — the *reference* value is on
 * the left. Since the tile overlap refs allocated for a masked layer are kept in the low
 * 7 bits, any `GEQUAL`/`EQUAL` test automatically fails wherever the high bit is set in the
 * buffer. So the existing tile-overlap and tile-clipping stencil behaviour is
 * preserved exactly, and masking composes with it for free.
 *
 * Both modes start by setting the mask bit across the whole render target, so that nothing is
 * drawn where the mask data isn't known yet (its tiles haven't loaded):
 *
 *   `clip-path-intersect` (e.g. marine data over water): *clear* the bit over the mask geometry.
 *             Result: draws over water only.
 *   `clip-path-exclude` (e.g. land data): *clear* the bit over the footprint of every mask tile
 *             that has loaded, then *set* it again over the mask geometry. Result: draws
 *             everywhere except water, and only where the water is known.
 *
 * Because the raster layer only writes to the stencil buffer where its test passed — and
 * where it passed the mask bit was already 0 — the raster draw itself cannot corrupt the
 * mask. After the layer is drawn, `clearRasterMask` resets the bit so later layers are
 * unaffected.
 *
 * Only visible, non-elevated `fill` layers are supported as masks, and `raster-elevation > 0`
 * is unsupported because such layers leave the draped batch and take a different draw path.
 * Whenever the mask can't be satisfied — the referenced layer, import or featureset is missing,
 * not loaded yet or unsupported — the raster layer is not drawn at all, the same as where the
 * mask tiles haven't loaded.
 */

type MaskSource = {
    layer: FillStyleLayer;
    sourceCache: SourceCache;
};

export type ResolvedRasterMask = {
    // The mask is the union of the geometry of all of these layers.
    sources: Array<MaskSource>;
    inside: boolean;
};

// The layer has a mask that can't be applied (see above), so it must not be drawn.
export type RasterMaskResolution = ResolvedRasterMask | 'unavailable';

/**
 * Finds the layers that make up the mask.
 *
 * Without `raster-mask-import`, `maskId` is a layer in the raster layer's own scope.
 *
 * With `raster-mask-import`, `maskId` names a featureset published by that import, and the mask is
 * made of the layers the featureset selects.
 */
function getMaskLayers(style: Painter['style'], layer: RasterStyleLayer, maskId: string, importId: string | undefined): Array<TypedStyleLayer> {
    if (!importId) {
        const found = style.getLayer(makeFQID(maskId, layer.scope));
        if (!found) {
            warnOnce(`raster-mask: no layer found with id "${maskId}" (referenced by layer "${layer.id}"); the raster layer is not drawn.`);
            return [];
        }
        return [found];
    }

    const owner = style.getFragmentStyle(layer.scope);
    const fragment = owner ? owner.getFragmentStyle(importId) : undefined;
    if (!fragment) {
        warnOnce(`raster-mask: no import found with id "${importId}" (referenced by layer "${layer.id}"); the raster layer is not drawn.`);
        return [];
    }

    // The import's style is still loading: its featuresets and layers aren't known yet.
    if (!fragment._loaded || !fragment.stylesheet) return [];

    const featuresets = fragment.stylesheet.featuresets;
    const featureset = featuresets ? featuresets[maskId] : undefined;
    if (!featureset) {
        warnOnce(`raster-mask: import "${importId}" has no featureset "${maskId}" (referenced by layer "${layer.id}"); the raster layer is not drawn.`);
        return [];
    }

    const layers = new Set<TypedStyleLayer>();
    for (const selector of featureset.selectors) {
        const found = fragment.getOwnLayer(selector.layer);
        if (found) layers.add(found);
    }
    if (!layers.size) {
        warnOnce(`raster-mask: featureset "${maskId}" of import "${importId}" selects no layers (referenced by layer "${layer.id}"); the raster layer is not drawn.`);
    }
    return Array.from(layers);
}

export function resolveRasterMask(painter: Painter, layer: RasterStyleLayer): RasterMaskResolution | null {
    const maskId = layer.paint.get('raster-mask');
    if (!maskId) return null;

    // Elevated rasters take a different draw path, with their own 3D stencil refs.
    if (layer.paint.get('raster-elevation') > 0) {
        warnOnce(`raster-mask: not supported together with "raster-elevation" (layer "${layer.id}"); the raster layer is not drawn.`);
        return 'unavailable';
    }

    const style = painter.style;
    const importId = layer.paint.get('raster-mask-import') || undefined;
    const terrainEnabled = !!(painter.terrain && painter.terrain.enabled);

    const sources: Array<MaskSource> = [];
    for (const maskLayer of getMaskLayers(style, layer, maskId, importId)) {
        // Only polygons can cover an area. A featureset may also select lines, symbols and so on.
        if (maskLayer.type !== 'fill') {
            warnOnce(`raster-mask: layer "${maskLayer.id}" is of type "${maskLayer.type}"; only "fill" layers are used as a mask (referenced by layer "${layer.id}").`);
            continue;
        }

        // Hidden layers have no geometry: their buckets are never built, and their source may not
        // be loaded at all.
        if (maskLayer.isHidden(painter.transform.zoom)) {
            warnOnce(`raster-mask: layer "${maskLayer.id}" is hidden at the current zoom or by its visibility, so it is not part of the mask of layer "${layer.id}". Use "fill-opacity": 0 to keep a mask layer invisible.`);
            continue;
        }

        // Elevated fills live in a separate buffer layout.
        if (maskLayer.is3D(terrainEnabled)) {
            warnOnce(`raster-mask: elevated fill layer "${maskLayer.id}" is not supported as a mask (referenced by layer "${layer.id}").`);
            continue;
        }

        const sourceCache = style.getLayerSourceCache(maskLayer);
        if (!sourceCache) {
            warnOnce(`raster-mask: no source found for layer "${maskLayer.id}" (referenced by layer "${layer.id}").`);
            continue;
        }

        sources.push({layer: maskLayer, sourceCache});
    }

    // Without any usable mask layer there is no clip data, so the raster layer is not drawn.
    if (!sources.length) return 'unavailable';

    return {
        sources,
        inside: layer.paint.get('raster-mask-mode') !== 'clip-path-exclude'
    };
}

function maskCoordsFor(painter: Painter, sourceCache: SourceCache): Array<OverscaledTileID> {
    const {terrain} = painter;
    if (terrain && terrain.renderingToTexture) {
        // Under draping we are rendering into a single proxy tile's framebuffer, so we need
        // the mask source's tiles proxied into that same tile space.
        // ProxiedTileID extends OverscaledTileID and carries the proxy-space projMatrix.
        return terrain.getCurrentProxiedCoords(sourceCache.id) || [];
    }
    return sourceCache.getVisibleCoordinates();
}

function drawFullTarget(painter: Painter, ref: number) {
    const {context} = painter;
    const gl = context.gl;

    painter.getOrCreateProgram('clippingMask').draw(painter, gl.TRIANGLES,
        DepthMode.disabled,
        new StencilMode({func: gl.ALWAYS, mask: 0}, ref, STENCIL_MASK_BIT, gl.KEEP, gl.KEEP, gl.REPLACE),
        ColorMode.disabled, CullFaceMode.disabled,
        clippingMaskUniformValues(painter.identityMat),
        '$raster-mask', painter.viewportBuffer,
        painter.quadTriangleIndexBuffer, painter.viewportSegments);
}

// A mask tile's data is known once it has loaded. While a tile reloads (e.g. after the mask layer
// was added) it may not have a bucket for the mask layer yet, which doesn't mean it has no geometry.
function isMaskTileKnown(tile: Tile | null | undefined, layer: FillStyleLayer): boolean {
    return !!tile && tile.hasData() && (tile.state !== 'reloading' || !!tile.getBucket(layer));
}

function drawTileFootprint(painter: Painter, tile: Tile, coord: OverscaledTileID, stencilMode: StencilMode) {
    const gl = painter.context.gl;
    // Proxy tiles are always in mercator space; see `Painter#_renderTileClippingMasks` for the
    // non-draped case.
    const {tileBoundsBuffer, tileBoundsIndexBuffer, tileBoundsSegments} = painter.terrain && painter.terrain.renderingToTexture ?
        painter.getMercatorTileBoundsBuffers() : painter.getTileBoundsBuffers(tile);

    painter.getOrCreateProgram('clippingMask').draw(painter, gl.TRIANGLES,
        DepthMode.disabled, stencilMode, ColorMode.disabled, CullFaceMode.disabled,
        clippingMaskUniformValues(coord.projMatrix),
        '$raster-mask', tileBoundsBuffer,
        tileBoundsIndexBuffer, tileBoundsSegments);
}

function drawMaskGeometry(painter: Painter, bucket: FillBucket, coord: OverscaledTileID, stencilMode: StencilMode) {
    const gl = painter.context.gl;
    const {bufferData} = bucket;
    if (!bufferData || !bufferData.layoutVertexBuffer || !bufferData.indexBuffer) return;
    if (bufferData.triangleSegments.get().length === 0) return;

    painter.getOrCreateProgram('clippingMask').draw(painter, gl.TRIANGLES,
        DepthMode.disabled, stencilMode, ColorMode.disabled, CullFaceMode.disabled,
        clippingMaskUniformValues(coord.projMatrix),
        '$raster-mask', bufferData.layoutVertexBuffer,
        bufferData.indexBuffer, bufferData.triangleSegments);
}

/**
 * Renders the mask into the reserved stencil bit of the currently bound framebuffer. Must be
 * called immediately before the raster layer's tiles are drawn, and after any other stencil
 * allocation for that layer (which may clear the buffer). `clearRasterMask` must be called once
 * the layer has been drawn.
 */
export function renderRasterMask(painter: Painter, mask: ResolvedRasterMask) {
    const gl = painter.context.gl;

    const setBit = new StencilMode({func: gl.ALWAYS, mask: 0}, STENCIL_MASK_BIT, STENCIL_MASK_BIT, gl.KEEP, gl.KEEP, gl.REPLACE);
    const clearBit = new StencilMode({func: gl.ALWAYS, mask: 0}, 0, STENCIL_MASK_BIT, gl.KEEP, gl.KEEP, gl.REPLACE);

    // Mark the whole target as masked, so that nothing is drawn where the mask isn't known. This
    // also overwrites a bit left set by earlier layers (e.g. the stencil pass of semi-transparent
    // lines inverts the whole byte).
    drawFullTarget(painter, STENCIL_MASK_BIT);

    const tiles: Array<{layer: FillStyleLayer, tile: Tile, coord: OverscaledTileID}> = [];
    for (const {layer, sourceCache} of mask.sources) {
        for (const coord of maskCoordsFor(painter, sourceCache)) {
            const tile = sourceCache.getTile(coord);
            if (isMaskTileKnown(tile, layer)) tiles.push({layer, tile, coord});
        }
    }

    if (mask.inside) {
        // Draw only inside the mask geometry. Unknown areas have no geometry, so stay masked.
        for (const {layer, tile, coord} of tiles) {
            const bucket = tile.getBucket(layer) as FillBucket | null | undefined;
            if (bucket) drawMaskGeometry(painter, bucket, coord, clearBit);
        }
        return;
    }

    // Draw wherever the mask is known, except inside its geometry. All footprints are drawn first,
    // since overlapping tiles (e.g. a parent standing in for loading children) would otherwise
    // clear geometry that has already been drawn. With mask layers from several sources, an area
    // counts as known once any of them has loaded there.
    for (const {tile, coord} of tiles) {
        drawTileFootprint(painter, tile, coord, clearBit);
    }
    for (const {layer, tile, coord} of tiles) {
        const bucket = tile.getBucket(layer) as FillBucket | null | undefined;
        if (bucket) drawMaskGeometry(painter, bucket, coord, setBit);
    }
}

export function clearRasterMask(painter: Painter) {
    drawFullTarget(painter, 0); // reset the reserved stencil bit so that subsequent layers test the full byte
}

export function stencilModeWithRasterMask(painter: Painter, stencilMode: Readonly<StencilMode> | undefined): Readonly<StencilMode> {
    const gl = painter.context.gl;

    if (!stencilMode || stencilMode === StencilMode.disabled || stencilMode.test.mask === 0) {
        // Test only the reserved bit and leave the buffer untouched.
        return new StencilMode({func: gl.EQUAL, mask: STENCIL_MASK_BIT}, 0, 0, gl.KEEP, gl.KEEP, gl.KEEP);
    }
    return stencilMode;
}
