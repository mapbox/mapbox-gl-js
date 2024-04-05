// @flow

import assert from 'assert';
import ImageSource from '../source/image_source.js';
import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import Texture from './texture.js';
import {rasterPoleUniformValues, rasterUniformValues} from './program/raster_program.js';

import {OverscaledTileID, CanonicalTileID} from '../source/tile_id.js';
import rasterFade from './raster_fade.js';
import {
    calculateGlobeMercatorMatrix,
    getGridMatrix,
    globeNormalizeECEF,
    globePoleMatrixForTile,
    globeTileBounds,
    globeToMercatorTransition,
    getLatitudinalLod,
    tileCornersToBounds,
} from "../geo/projection/globe_util.js";
import {GLOBE_ZOOM_THRESHOLD_MIN} from '../geo/projection/globe_constants.js';
import {mat4} from "gl-matrix";
import {mercatorXfromLng, mercatorYfromLat} from "../geo/mercator_coordinate.js";
import Transform from '../geo/transform.js';
import {COLOR_MIX_FACTOR} from '../style/style_layer/raster_style_layer.js';
import RasterArrayTile from '../source/raster_array_tile.js';
import RasterArrayTileSource from '../source/raster_array_tile_source.js';

import type Tile from '../source/tile.js';
import type Context from '../gl/context.js';
import type Painter from './painter.js';
import type SourceCache from '../source/source_cache.js';
import type RasterStyleLayer from '../style/style_layer/raster_style_layer.js';
import type {Source} from '../source/source.js';
import type {UserManagedTexture} from './texture.js';
import type {DynamicDefinesType} from '../render/program/program_uniforms.js';

export default drawRaster;

const RASTER_COLOR_TEXTURE_UNIT = 2;

type RasterConfig = {
    defines: DynamicDefinesType[];
    mix: [number, number, number, number];
    range: [number, number];
    offset: number;
    resampling: number;
};

function adjustColorMix(colorMix: [number, number, number, number]): [number, number, number, number] {
    // Adjust colorMix by the color mix factor to get the proper values for the `computeRasterColorMix` function
    // For more details refer to `computeRasterColorMix` in src/style/style_layer/raster_style_layer.js
    return [
        colorMix[0] * COLOR_MIX_FACTOR,
        colorMix[1] * COLOR_MIX_FACTOR,
        colorMix[2] * COLOR_MIX_FACTOR,
        0
    ];
}

function drawRaster(painter: Painter, sourceCache: SourceCache, layer: RasterStyleLayer, tileIDs: Array<OverscaledTileID>, variableOffsets: any, isInitialLoad: boolean) {
    if (painter.renderPass !== 'translucent') return;
    if (layer.paint.get('raster-opacity') === 0) return;
    const isGlobeProjection = painter.transform.projection.name === 'globe';
    const renderingWithElevation = layer.paint.get('raster-elevation') !== 0.0;
    const renderingElevatedOnGlobe = renderingWithElevation && isGlobeProjection;
    if (painter.renderElevatedRasterBackface && !renderingElevatedOnGlobe) {
        return;
    }

    const context = painter.context;
    const gl = context.gl;
    const source = sourceCache.getSource();

    const rasterConfig = configureRaster(source, layer, context, gl);

    if (source instanceof ImageSource && !tileIDs.length) {
        if (!isGlobeProjection) {
            return;
        }
    }

    const emissiveStrength = layer.paint.get('raster-emissive-strength');
    const colorMode = painter.colorModeForDrapableLayerRenderPass(emissiveStrength);

    // When rendering to texture, coordinates are already sorted: primary by
    // proxy id and secondary sort is by Z.
    const renderingToTexture = painter.terrain && painter.terrain.renderingToTexture;

    const align = !painter.options.moving;
    const textureFilter = layer.paint.get('raster-resampling') === 'nearest' ? gl.NEAREST : gl.LINEAR;

    if (source instanceof ImageSource && !tileIDs.length && (source.onNorthPole || source.onSouthPole)) {
        const stencilMode = renderingWithElevation ? painter.stencilModeFor3D() : StencilMode.disabled;
        if (source.onNorthPole) {
            drawPole(true, null, painter, sourceCache, layer, emissiveStrength, rasterConfig, CullFaceMode.disabled, stencilMode);
        } else {
            drawPole(false, null, painter, sourceCache, layer, emissiveStrength, rasterConfig, CullFaceMode.disabled, stencilMode);
        }
        return;
    }

    if (!tileIDs.length) {
        return;
    }
    const [stencilModes, coords] = source instanceof ImageSource || renderingToTexture ? [{}, tileIDs] :
        painter.stencilConfigForOverlap(tileIDs);
    const minTileZ = coords[coords.length - 1].overscaledZ;

    if (renderingElevatedOnGlobe) {
        rasterConfig.defines.push("PROJECTION_GLOBE_VIEW");
    }
    if (renderingWithElevation) {
        rasterConfig.defines.push("RENDER_CUTOFF");
    }

    const drawTiles = (tiles: Array<OverscaledTileID>, cullFaceMode: CullFaceMode, elevatedStencilMode?: StencilMode) => {
        for (const coord of tiles) {
            const unwrappedTileID = coord.toUnwrapped();
            const tile = sourceCache.getTile(coord);
            if (renderingToTexture && !(tile && tile.hasData())) continue;

            context.activeTexture.set(gl.TEXTURE0);
            const textureDescriptor = getTextureDescriptor(tile, source, layer, rasterConfig);
            if (!textureDescriptor || !textureDescriptor.texture) continue;
            const {texture, mix: rasterColorMix, offset: rasterColorOffset, tileSize, buffer} = textureDescriptor;

            let depthMode;
            let projMatrix;
            if (renderingToTexture) {
                depthMode = DepthMode.disabled;
                projMatrix = coord.projMatrix;
            } else if (renderingWithElevation) {
                depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
                projMatrix = isGlobeProjection ? Float32Array.from(painter.transform.expandedFarZProjMatrix) : painter.transform.calculateProjMatrix(unwrappedTileID, align);
            } else {
                // Set the lower zoom level to sublayer 0, and higher zoom levels to higher sublayers
                // Use gl.LESS to prevent double drawing in areas where tiles overlap.
                depthMode = painter.depthModeForSublayer(coord.overscaledZ - minTileZ,
                    layer.paint.get('raster-opacity') === 1 ? DepthMode.ReadWrite : DepthMode.ReadOnly, gl.LESS);
                projMatrix = painter.transform.calculateProjMatrix(unwrappedTileID, align);
            }

            const stencilMode = painter.terrain && renderingToTexture ?
                painter.terrain.stencilModeForRTTOverlap(coord) :
                stencilModes[coord.overscaledZ];

            const rasterFadeDuration = isInitialLoad ? 0 : layer.paint.get('raster-fade-duration');
            tile.registerFadeDuration(rasterFadeDuration);

            const parentTile = sourceCache.findLoadedParent(coord, 0);
            const fade = rasterFade(tile, parentTile, sourceCache, painter.transform, rasterFadeDuration);
            if (painter.terrain) painter.terrain.prepareDrawTile();

            let parentScaleBy, parentTL;

            context.activeTexture.set(gl.TEXTURE0);
            texture.bind(textureFilter, gl.CLAMP_TO_EDGE);

            context.activeTexture.set(gl.TEXTURE1);

            if (parentTile) {
                if (parentTile.texture) {
                    parentTile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE);
                }
                parentScaleBy = Math.pow(2, parentTile.tileID.overscaledZ - tile.tileID.overscaledZ);
                parentTL = [tile.tileID.canonical.x * parentScaleBy % 1, tile.tileID.canonical.y * parentScaleBy % 1];

            } else {
                texture.bind(textureFilter, gl.CLAMP_TO_EDGE);
            }

            // Enable trilinear filtering on tiles only beyond 20 degrees pitch,
            // to prevent it from compromising image crispness on flat or low tilted maps.
            if (texture.useMipmap && context.extTextureFilterAnisotropic && painter.transform.pitch > 20) {
                gl.texParameterf(gl.TEXTURE_2D, context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, context.extTextureFilterAnisotropicMax);
            }

            const tr = painter.transform;
            let perspectiveTransform: [number, number];
            const cutoffParams = renderingWithElevation ? cutoffParamsForElevation(tr) : [0, 0, 0, 0];

            let normalizeMatrix: Float32Array;
            let globeMatrix: Float32Array;
            let globeMercatorMatrix: Float32Array;
            let mercatorCenter: [number, number];
            let gridMatrix: Float32Array;
            let latitudinalLod = 0;

            if (renderingElevatedOnGlobe && source instanceof ImageSource && source.coordinates.length > 3) {
                normalizeMatrix = Float32Array.from(globeNormalizeECEF(globeTileBounds(new CanonicalTileID(0, 0, 0))));
                globeMatrix = Float32Array.from(tr.globeMatrix);
                globeMercatorMatrix = Float32Array.from(calculateGlobeMercatorMatrix(tr));
                mercatorCenter = [mercatorXfromLng(tr.center.lng), mercatorYfromLat(tr.center.lat)];
                perspectiveTransform = source.elevatedGlobePerspectiveTransform;
                gridMatrix = source.elevatedGlobeGridMatrix || new Float32Array(9);
            } else if (renderingElevatedOnGlobe) {
                const tileBounds = tileCornersToBounds(coord.canonical);
                latitudinalLod = getLatitudinalLod(tileBounds.getCenter().lat);
                normalizeMatrix = Float32Array.from(globeNormalizeECEF(globeTileBounds(coord.canonical)));
                globeMatrix = Float32Array.from(tr.globeMatrix);
                globeMercatorMatrix = Float32Array.from(calculateGlobeMercatorMatrix(tr));
                mercatorCenter = [mercatorXfromLng(tr.center.lng), mercatorYfromLat(tr.center.lat)];
                perspectiveTransform = [0, 0];
                gridMatrix = Float32Array.from(getGridMatrix(coord.canonical, tileBounds, latitudinalLod, tr.worldSize / tr._pixelsPerMercatorPixel));
            } else {
                perspectiveTransform = source instanceof ImageSource ? source.perspectiveTransform : [0, 0];
                normalizeMatrix = new Float32Array(16);
                globeMatrix = new Float32Array(9);
                globeMercatorMatrix = new Float32Array(16);
                mercatorCenter = [0, 0];
                gridMatrix = new Float32Array(9);
            }

            const uniformValues = rasterUniformValues(
                projMatrix,
                normalizeMatrix,
                globeMatrix,
                globeMercatorMatrix,
                gridMatrix,
                parentTL || [0, 0],
                globeToMercatorTransition(painter.transform.zoom),
                mercatorCenter,
                cutoffParams,
                parentScaleBy || 1,
                fade,
                layer,
                perspectiveTransform,
                renderingWithElevation ? layer.paint.get('raster-elevation') : 0.0,
                RASTER_COLOR_TEXTURE_UNIT,
                rasterColorMix,
                rasterColorOffset,
                rasterConfig.range,
                tileSize,
                buffer,
                emissiveStrength
            );
            const affectedByFog = painter.isTileAffectedByFog(coord);

            const program = painter.getOrCreateProgram('raster', {defines: rasterConfig.defines, overrideFog: affectedByFog});

            painter.uploadCommonUniforms(context, program, unwrappedTileID);

            if (source instanceof ImageSource) {
                const elevatedGlobeVertexBuffer = source.elevatedGlobeVertexBuffer;
                const elevatedGlobeIndexBuffer = source.elevatedGlobeIndexBuffer;
                if (renderingToTexture || !isGlobeProjection) {
                    if (source.boundsBuffer && source.boundsSegments) program.draw(
                        painter, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.disabled,
                        uniformValues, layer.id, source.boundsBuffer,
                        painter.quadTriangleIndexBuffer, source.boundsSegments);
                } else if (elevatedGlobeVertexBuffer && elevatedGlobeIndexBuffer) {
                    const segments = tr.zoom <= GLOBE_ZOOM_THRESHOLD_MIN ?
                        source.elevatedGlobeSegments :
                        source.getSegmentsForLongitude(tr.center.lng);
                    if (segments) {
                        program.draw(
                            painter, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, cullFaceMode,
                            uniformValues, layer.id, elevatedGlobeVertexBuffer,
                            elevatedGlobeIndexBuffer, segments);
                    }
                }
            } else if (renderingElevatedOnGlobe) {
                depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, painter.depthRangeFor3D);
                const sharedBuffers = painter.globeSharedBuffers;
                if (sharedBuffers) {
                    const [buffer, indexBuffer, segments] = sharedBuffers.getGridBuffers(latitudinalLod, false);
                    assert(buffer);
                    assert(indexBuffer);
                    assert(segments);
                    program.draw(painter, gl.TRIANGLES, depthMode, elevatedStencilMode || stencilMode, painter.colorModeForRenderPass(), cullFaceMode, uniformValues, layer.id, buffer, indexBuffer, segments);
                }
            } else {
                const {tileBoundsBuffer, tileBoundsIndexBuffer, tileBoundsSegments} = painter.getTileBoundsBuffers(tile);

                program.draw(painter, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
                    uniformValues, layer.id, tileBoundsBuffer,
                    tileBoundsIndexBuffer, tileBoundsSegments);
            }
        }

        if (!(source instanceof ImageSource) && renderingElevatedOnGlobe) {
            for (const coord of tiles) {
                const topCap = coord.canonical.y === 0;
                const bottomCap = coord.canonical.y === (1 << coord.canonical.z) - 1;
                if (topCap) {
                    drawPole(true, coord, painter, sourceCache, layer, emissiveStrength, rasterConfig, cullFaceMode, elevatedStencilMode || StencilMode.disabled);
                }
                if (bottomCap) {
                    drawPole(false, coord, painter, sourceCache, layer, emissiveStrength, rasterConfig, cullFaceMode === CullFaceMode.frontCW ? CullFaceMode.backCW : CullFaceMode.frontCW, elevatedStencilMode || StencilMode.disabled);
                }
            }
        }
    };

    if (renderingElevatedOnGlobe) {
        if (painter.renderElevatedRasterBackface) {
            drawTiles(coords, CullFaceMode.backCW, painter.stencilModeFor3D());
        } else {
            drawTiles(coords, CullFaceMode.frontCW, painter.stencilModeFor3D());
        }
    } else {
        drawTiles(coords, CullFaceMode.disabled, undefined);
    }

    painter.resetStencilClippingMasks();
}

function drawPole(isNorth: boolean, coord: ?OverscaledTileID, painter: Painter, sourceCache: SourceCache, layer: RasterStyleLayer, emissiveStrength: number, rasterConfig: any, cullFaceMode: CullFaceMode, stencilMode: StencilMode) {
    const source = sourceCache.getSource();
    const sharedBuffers = painter.globeSharedBuffers;
    if (!sharedBuffers) return;

    let tile;
    if (coord) {
        tile = sourceCache.getTile(coord);
    }
    let texture;
    let globeMatrix;
    if (source instanceof ImageSource) {
        texture = source.texture;
        globeMatrix = globePoleMatrixForTile(0, 0, painter.transform);
    } else if (tile && coord) {
        texture = tile.texture;
        globeMatrix = globePoleMatrixForTile(coord.canonical.z, coord.canonical.x, painter.transform);
    }
    if (!texture || !globeMatrix) return;

    if (!isNorth) {
        globeMatrix = mat4.scale(mat4.create(), globeMatrix, [1, -1, 1]);
    }

    const context = painter.context;
    const gl = context.gl;
    const textureFilter = layer.paint.get('raster-resampling') === 'nearest' ? gl.NEAREST : gl.LINEAR;
    const colorMode = painter.colorModeForDrapableLayerRenderPass(emissiveStrength);
    const defines = rasterConfig.defines;
    defines.push("GLOBE_POLES");

    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    const projMatrix = Float32Array.from(painter.transform.expandedFarZProjMatrix);
    const normalizeMatrix = Float32Array.from(globeNormalizeECEF(globeTileBounds(new CanonicalTileID(0, 0, 0))));
    const fade = {opacity: 1, mix: 0};

    if (painter.terrain) painter.terrain.prepareDrawTile();

    context.activeTexture.set(gl.TEXTURE0);
    texture.bind(textureFilter, gl.CLAMP_TO_EDGE);
    context.activeTexture.set(gl.TEXTURE1);
    texture.bind(textureFilter, gl.CLAMP_TO_EDGE);

    // Enable trilinear filtering on tiles only beyond 20 degrees pitch,
    // to prevent it from compromising image crispness on flat or low tilted maps.
    if (texture.useMipmap && context.extTextureFilterAnisotropic && painter.transform.pitch > 20) {
        gl.texParameterf(gl.TEXTURE_2D, context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, context.extTextureFilterAnisotropicMax);
    }

    const [
        northPoleBuffer,
        southPoleBuffer,
        indexBuffer,
        segment
    ] = coord ? sharedBuffers.getPoleBuffers(coord.canonical.z, false) : sharedBuffers.getPoleBuffers(0, true);
    const elevation = layer.paint.get('raster-elevation');
    let vertexBuffer;
    if (isNorth) {
        vertexBuffer = northPoleBuffer;
        painter.renderDefaultNorthPole = elevation !== 0.0;
    } else {
        vertexBuffer = southPoleBuffer;
        painter.renderDefaultSouthPole = elevation !== 0.0;
    }
    const rasterColorMix = adjustColorMix(rasterConfig.mix);
    const uniformValues = rasterPoleUniformValues(projMatrix, normalizeMatrix, globeMatrix, globeToMercatorTransition(painter.transform.zoom), fade, layer, [0, 0], elevation, RASTER_COLOR_TEXTURE_UNIT, rasterColorMix, rasterConfig.offset, rasterConfig.range, emissiveStrength);
    const program = painter.getOrCreateProgram('raster', {defines});

    painter.uploadCommonUniforms(context, program, null);
    program.draw(
        painter, gl.TRIANGLES, depthMode, stencilMode, colorMode, cullFaceMode,
        uniformValues, layer.id, vertexBuffer,
        indexBuffer, segment);
}

// Configure a fade out effect for elevated raster layers when they're close to the camera
function cutoffParamsForElevation(tr: Transform): [number, number, number, number] {
    const near = tr._nearZ;
    const far = tr.projection.farthestPixelDistance(tr);
    const zRange = far - near;
    const fadeRangePixels = tr.height * 0.2;
    const cutoffDistance = near + fadeRangePixels;
    const relativeCutoffDistance = ((cutoffDistance - near) / zRange);
    const relativeCutoffFadeDistance = ((cutoffDistance - fadeRangePixels - near) / zRange);
    return [near, far, relativeCutoffFadeDistance, relativeCutoffDistance];
}

export function prepare(layer: RasterStyleLayer, sourceCache: SourceCache, _: Painter): void {
    const source = sourceCache.getSource();
    if (!(source instanceof RasterArrayTileSource) || !source.loaded()) return;

    const sourceLayer = layer.sourceLayer || (source.rasterLayerIds && source.rasterLayerIds[0]);
    if (!sourceLayer) return;

    const band = layer.paint.get('raster-array-band') || source.getInitialBand(sourceLayer);
    if (band == null) return;

    // $FlowFixMe[incompatible-type]
    const tiles: Array<RasterArrayTile> = sourceCache.getIds().map(id => sourceCache.getTileByID(id));
    for (const tile of tiles) {
        if (tile.updateNeeded(sourceLayer, band)) {
            source.prepareTile(tile, sourceLayer, band);
        }
    }
}

export type TextureDescriptor = {
    texture: ?Texture | ?UserManagedTexture,
    mix: [number, number, number, number],
    offset: number,
    buffer: number,
    tileSize: number,
};

function getTextureDescriptor(tile: ?Tile | ?RasterArrayTile, source: Source | RasterArrayTileSource, layer: RasterStyleLayer, rasterConfig: RasterConfig): TextureDescriptor | void {
    if (!tile) return;

    if (source instanceof RasterArrayTileSource && tile instanceof RasterArrayTile) {
        return ((source.getTextureDescriptor(tile, layer, true): any): TextureDescriptor);
    }

    return {
        texture: tile.texture,
        mix: adjustColorMix(rasterConfig.mix),
        offset: rasterConfig.offset,
        buffer: 0,
        tileSize: 1,
    };
}

function configureRaster(source: Source, layer: RasterStyleLayer, context: Context, gl: WebGL2RenderingContext): RasterConfig {
    const isRasterColor = layer.paint.get('raster-color');
    const isRasterArray = source.type === 'raster-array';

    const defines: DynamicDefinesType[] = [];
    const inputResampling = layer.paint.get('raster-resampling');
    const inputMix = layer.paint.get('raster-color-mix');
    let range = layer.paint.get('raster-color-range');

    // Unpack the offset for use in a separate uniform
    const mix = [inputMix[0], inputMix[1], inputMix[2], 0];
    const offset = inputMix[3];

    let resampling = inputResampling === 'nearest' ? gl.NEAREST : gl.LINEAR;

    if (isRasterArray) {
        defines.push('RASTER_ARRAY');

        // Raster-array sources require RASTER_COLOR for raster array data decoding and binary 0/1 mask interpolation
        if (!isRasterColor) defines.push('RASTER_COLOR');

        // Raster-array sources require in-shader linear interpolation in order to decode without
        // artifacts, so force nearest filtering.
        if (inputResampling === 'linear') defines.push('RASTER_ARRAY_LINEAR');
        resampling = gl.NEAREST;

        if (!range) {
            if (source.rasterLayers) {
                const foundLayer = source.rasterLayers.find(({id}) => id === layer.sourceLayer);
                if (foundLayer && foundLayer.fields && foundLayer.fields.range) {
                    range = foundLayer.fields.range;
                }
            }
        }
    }

    // In all cases, having checked for a preferred color ramp, we now supply a default,
    // to be used in case nothing else has been specified.
    range = range || [0, 1];

    if (isRasterColor) {
        defines.push('RASTER_COLOR');
        // Allocate a texture if not allocated
        context.activeTexture.set(gl.TEXTURE2);

        // Update the color ramp defensively. Duplicate calls with the same bounds
        // will not trigger recomputation.
        layer.updateColorRamp(range);

        let tex = layer.colorRampTexture;
        if (!tex) tex = layer.colorRampTexture = new Texture(context, layer.colorRamp, gl.RGBA);
        tex.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    }

    return {
        mix,
        range,
        offset,
        defines,
        resampling
    };
}
