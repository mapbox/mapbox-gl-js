// @flow

import Point from '@mapbox/point-geometry';
import drawCollisionDebug from './draw_collision_debug.js';

import SegmentVector from '../data/segment.js';
import * as symbolProjection from '../symbol/projection.js';
import * as symbolSize from '../symbol/symbol_size.js';
import {mat4, vec3, vec4} from 'gl-matrix';
const identityMat4 = mat4.create();
import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import {addDynamicAttributes} from '../data/bucket/symbol_bucket.js';
import {getAnchorAlignment, WritingMode} from '../symbol/shaping.js';
import ONE_EM from '../symbol/one_em.js';
import {evaluateVariableOffset} from '../symbol/symbol_layout.js';
import Tile from '../source/tile.js';
import type Transform from '../geo/transform.js';
import {
    mercatorXfromLng,
    mercatorYfromLat
} from '../geo/mercator_coordinate.js';
import {globeToMercatorTransition} from '../geo/projection/globe_util.js';

import {
    symbolIconUniformValues,
    symbolSDFUniformValues,
    symbolTextAndIconUniformValues
} from './program/symbol_program.js';
import {getSymbolTileProjectionMatrix} from '../geo/projection/projection_util.js';
import type Painter from './painter.js';
import type SourceCache from '../source/source_cache.js';
import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer.js';
import type SymbolBucket, {SymbolBuffers} from '../data/bucket/symbol_bucket.js';
import type Texture from '../render/texture.js';
import {OverscaledTileID} from '../source/tile_id.js';
import type {UniformValues} from './uniform_binding.js';
import type {SymbolSDFUniformsType} from '../render/program/symbol_program.js';
import type {CrossTileID, VariableOffset} from '../symbol/placement.js';
import type {Vec3} from 'gl-matrix';

export default drawSymbols;

type SymbolTileRenderState = {
    segments: SegmentVector,
    sortKey: number,
    state: {
        program: any,
        buffers: SymbolBuffers,
        uniformValues: any,
        atlasTexture: Texture,
        atlasTextureIcon: Texture | null,
        atlasInterpolation: any,
        atlasInterpolationIcon: any,
        isSDF: boolean,
        hasHalo: boolean,
        tile: Tile,
        labelPlaneMatrixInv: ?Float32Array
    }
};

function drawSymbols(painter: Painter, sourceCache: SourceCache, layer: SymbolStyleLayer, coords: Array<OverscaledTileID>, variableOffsets: {[_: CrossTileID]: VariableOffset}) {
    if (painter.renderPass !== 'translucent') return;

    // Disable the stencil test so that labels aren't clipped to tile boundaries.
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();
    const variablePlacement = layer.layout.get('text-variable-anchor');

    //Compute variable-offsets before painting since icons and text data positioning
    //depend on each other in this case.
    if (variablePlacement) {
        updateVariableAnchors(coords, painter, layer, sourceCache,
            layer.layout.get('text-rotation-alignment'),
            layer.layout.get('text-pitch-alignment'),
            variableOffsets
        );
    }

    if (layer.paint.get('icon-opacity').constantOr(1) !== 0) {
        drawLayerSymbols(painter, sourceCache, layer, coords, false,
            layer.paint.get('icon-translate'),
            layer.paint.get('icon-translate-anchor'),
            layer.layout.get('icon-rotation-alignment'),
            layer.layout.get('icon-pitch-alignment'),
            layer.layout.get('icon-keep-upright'),
            stencilMode, colorMode
        );
    }

    if (layer.paint.get('text-opacity').constantOr(1) !== 0) {
        drawLayerSymbols(painter, sourceCache, layer, coords, true,
            layer.paint.get('text-translate'),
            layer.paint.get('text-translate-anchor'),
            layer.layout.get('text-rotation-alignment'),
            layer.layout.get('text-pitch-alignment'),
            layer.layout.get('text-keep-upright'),
            stencilMode, colorMode
        );
    }

    if (sourceCache.map.showCollisionBoxes) {
        drawCollisionDebug(painter, sourceCache, layer, coords, layer.paint.get('text-translate'),
            layer.paint.get('text-translate-anchor'), true);
        drawCollisionDebug(painter, sourceCache, layer, coords, layer.paint.get('icon-translate'),
            layer.paint.get('icon-translate-anchor'), false);
    }
}

function computeGlobeCameraUp(transform: Transform): [number, number, number] {
    const viewMatrix = transform._camera.getWorldToCamera(transform.worldSize, 1);
    const viewToEcef = mat4.multiply([], viewMatrix, transform.globeMatrix);
    mat4.invert(viewToEcef, viewToEcef);

    const cameraUpVector = [0, 0, 0];
    const up = [0, 1, 0, 0];
    vec4.transformMat4(up, up,  viewToEcef);
    cameraUpVector[0] = up[0];
    cameraUpVector[1] = up[1];
    cameraUpVector[2] = up[2];
    vec3.normalize(cameraUpVector, cameraUpVector);

    return cameraUpVector;
}

function calculateVariableRenderShift(anchor, width, height, textOffset, textScale, renderTextSize): Point {
    const {horizontalAlign, verticalAlign} = getAnchorAlignment(anchor);
    const shiftX = -(horizontalAlign - 0.5) * width;
    const shiftY = -(verticalAlign - 0.5) * height;
    const variableOffset = evaluateVariableOffset(anchor, textOffset);
    return new Point(
        (shiftX / textScale + variableOffset[0]) * renderTextSize,
        (shiftY / textScale + variableOffset[1]) * renderTextSize
    );
}

function updateVariableAnchors(coords, painter, layer, sourceCache, rotationAlignment, pitchAlignment, variableOffsets) {
    const tr = painter.transform;
    const rotateWithMap = rotationAlignment === 'map';
    const pitchWithMap = pitchAlignment === 'map';

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket: SymbolBucket = (tile.getBucket(layer): any);
        if (!bucket || !bucket.text || !bucket.text.segments.get().length) {
            continue;
        }

        const sizeData = bucket.textSizeData;
        const size = symbolSize.evaluateSizeForZoom(sizeData, tr.zoom);
        const tileMatrix = getSymbolTileProjectionMatrix(coord, bucket.getProjection(), tr);

        const pixelsToTileUnits = tr.calculatePixelsToTileUnitsMatrix(tile);
        const labelPlaneMatrix = symbolProjection.getLabelPlaneMatrixForRendering(tileMatrix, tile.tileID.canonical, pitchWithMap, rotateWithMap, tr, bucket.getProjection(), pixelsToTileUnits);
        const updateTextFitIcon = layer.layout.get('icon-text-fit') !== 'none' &&  bucket.hasIconData();

        if (size) {
            const tileScale = Math.pow(2, tr.zoom - tile.tileID.overscaledZ);
            updateVariableAnchorsForBucket(bucket, rotateWithMap, pitchWithMap, variableOffsets, symbolSize,
                                  tr, labelPlaneMatrix, coord, tileScale, size, updateTextFitIcon);
        }
    }
}

function updateVariableAnchorsForBucket(bucket, rotateWithMap, pitchWithMap, variableOffsets, symbolSize,
                               transform, labelPlaneMatrix, coord, tileScale, size, updateTextFitIcon) {
    const placedSymbols = bucket.text.placedSymbolArray;
    const dynamicTextLayoutVertexArray = bucket.text.dynamicLayoutVertexArray;
    const dynamicIconLayoutVertexArray = bucket.icon.dynamicLayoutVertexArray;
    const placedTextShifts = {};
    const tileMatrix = getSymbolTileProjectionMatrix(coord, bucket.getProjection(), transform);
    const elevation = transform.elevation;
    const upVectorScale = bucket.getProjection().upVectorScale(coord.canonical, transform.center.lat, transform.worldSize);

    dynamicTextLayoutVertexArray.clear();
    for (let s = 0; s < placedSymbols.length; s++) {
        const symbol: any = placedSymbols.get(s);
        const skipOrientation = bucket.allowVerticalPlacement && !symbol.placedOrientation;
        const variableOffset = (!symbol.hidden && symbol.crossTileID && !skipOrientation) ? variableOffsets[symbol.crossTileID] : null;

        if (!variableOffset) {
            // These symbols are from a justification that is not being used, or a label that wasn't placed
            // so we don't need to do the extra math to figure out what incremental shift to apply.
            symbolProjection.hideGlyphs(symbol.numGlyphs, dynamicTextLayoutVertexArray);
        } else  {
            const tileAnchor = new Point(symbol.tileAnchorX, symbol.tileAnchorY);
            const upDir = bucket.getProjection().upVector(coord.canonical, tileAnchor.x, tileAnchor.y);
            const anchorElevation = elevation ? elevation.getAtTileOffset(coord, tileAnchor.x, tileAnchor.y) : 0.0;
            const reprojectedAnchor = [
                symbol.projectedAnchorX + anchorElevation * upDir[0] * upVectorScale.metersToTile,
                symbol.projectedAnchorY + anchorElevation * upDir[1] * upVectorScale.metersToTile,
                symbol.projectedAnchorZ + anchorElevation * upDir[2] * upVectorScale.metersToTile
            ];

            const projectedAnchor = symbolProjection.projectVector(reprojectedAnchor, pitchWithMap ? tileMatrix : labelPlaneMatrix);
            const perspectiveRatio = symbolProjection.getPerspectiveRatio(transform.getCameraToCenterDistance(bucket.getProjection()), projectedAnchor.signedDistanceFromCamera);
            let renderTextSize = symbolSize.evaluateSizeForFeature(bucket.textSizeData, size, symbol) * perspectiveRatio / ONE_EM;
            if (pitchWithMap) {
                // Go from size in pixels to equivalent size in tile units
                renderTextSize *= bucket.tilePixelRatio / tileScale;
            }

            const {width, height, anchor, textOffset, textScale} = variableOffset;

            const shift = calculateVariableRenderShift(
                anchor, width, height, textOffset, textScale, renderTextSize);

            // Usual case is that we take the projected anchor and add the pixel-based shift
            // calculated above. In the (somewhat weird) case of pitch-aligned text, we add an equivalent
            // tile-unit based shift to the anchor before projecting to the label plane.
            let shiftedAnchor: Vec3;

            if (pitchWithMap) {
                const shiftedTileAnchor = tileAnchor.add(shift);
                const {x, y, z} = bucket.getProjection().projectTilePoint(shiftedTileAnchor.x, shiftedTileAnchor.y, coord.canonical);

                const reprojectedShiftedAnchor = [
                    x + anchorElevation * upDir[0] * upVectorScale.metersToTile,
                    y + anchorElevation * upDir[1] * upVectorScale.metersToTile,
                    z + anchorElevation * upDir[2] * upVectorScale.metersToTile
                ];

                shiftedAnchor = symbolProjection.projectVector(reprojectedShiftedAnchor, labelPlaneMatrix).point;
            } else {
                const rotatedShift = rotateWithMap ? shift.rotate(-transform.angle) : shift;
                shiftedAnchor = [projectedAnchor.point[0] + rotatedShift.x, projectedAnchor.point[1] + rotatedShift.y, 0];
            }

            const angle = (bucket.allowVerticalPlacement && symbol.placedOrientation === WritingMode.vertical) ? Math.PI / 2 : 0;
            for (let g = 0; g < symbol.numGlyphs; g++) {
                addDynamicAttributes(dynamicTextLayoutVertexArray, shiftedAnchor[0], shiftedAnchor[1], shiftedAnchor[2], angle);
            }
            //Only offset horizontal text icons
            if (updateTextFitIcon && symbol.associatedIconIndex >= 0) {
                placedTextShifts[symbol.associatedIconIndex] = {shiftedAnchor, angle};
            }
        }
    }

    if (updateTextFitIcon) {
        dynamicIconLayoutVertexArray.clear();
        const placedIcons = bucket.icon.placedSymbolArray;
        for (let i = 0; i < placedIcons.length; i++) {
            const placedIcon = placedIcons.get(i);
            if (placedIcon.hidden) {
                symbolProjection.hideGlyphs(placedIcon.numGlyphs, dynamicIconLayoutVertexArray);
            } else {
                const shift = placedTextShifts[i];
                if (!shift) {
                    symbolProjection.hideGlyphs(placedIcon.numGlyphs, dynamicIconLayoutVertexArray);
                } else {
                    for (let g = 0; g < placedIcon.numGlyphs; g++) {
                        addDynamicAttributes(dynamicIconLayoutVertexArray, shift.shiftedAnchor[0], shift.shiftedAnchor[1], shift.shiftedAnchor[2], shift.angle);
                    }
                }
            }
        }
        bucket.icon.dynamicLayoutVertexBuffer.updateData(dynamicIconLayoutVertexArray);
    }
    bucket.text.dynamicLayoutVertexBuffer.updateData(dynamicTextLayoutVertexArray);
}

function getSymbolProgramName(isSDF: boolean, isText: boolean, bucket: SymbolBucket) {
    if (bucket.iconsInText && isText) {
        return 'symbolTextAndIcon';
    } else if (isSDF) {
        return 'symbolSDF';
    } else {
        return 'symbolIcon';
    }
}

function drawLayerSymbols(painter, sourceCache, layer, coords, isText, translate, translateAnchor,
                          rotationAlignment, pitchAlignment, keepUpright, stencilMode, colorMode) {
    const context = painter.context;
    const gl = context.gl;
    const tr = painter.transform;

    const rotateWithMap = rotationAlignment === 'map';
    const pitchWithMap = pitchAlignment === 'map';
    const alongLine = rotateWithMap && layer.layout.get('symbol-placement') !== 'point';

    // Line label rotation happens in `updateLineLabels`
    // Pitched point labels are automatically rotated by the labelPlaneMatrix projection
    // Unpitched point labels need to have their rotation applied after projection
    const rotateInShader = rotateWithMap && !pitchWithMap && !alongLine;

    const hasSortKey = layer.layout.get('symbol-sort-key').constantOr(1) !== undefined;
    let sortFeaturesByKey = false;

    const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
    const mercatorCenter = [
        mercatorXfromLng(tr.center.lng),
        mercatorYfromLat(tr.center.lat)
    ];
    const variablePlacement = layer.layout.get('text-variable-anchor');
    const isGlobeProjection = tr.projection.name === 'globe';
    const tileRenderState: Array<SymbolTileRenderState> = [];

    const mercatorCameraUp = [0, -1, 0];

    let globeCameraUp = mercatorCameraUp;
    if ((isGlobeProjection || tr.mercatorFromTransition) && !rotateWithMap) {
        // Each symbol rotating with the viewport requires per-instance information about
        // how to align with the viewport. In 2D case rotation is shared between all of the symbols and
        // hence embedded in the label plane matrix but in globe view this needs to be computed at runtime.
        // Camera up vector together with surface normals can be used to find the correct orientation for each symbol.
        globeCameraUp = computeGlobeCameraUp(tr);
    }

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket: SymbolBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;
        // Allow rendering of buckets built for globe projection in mercator mode
        // until the substitute tile has been loaded
        if (bucket.projection.name === 'mercator' && isGlobeProjection) {
            continue;
        }
        const buffers = isText ? bucket.text : bucket.icon;
        if (!buffers || bucket.fullyClipped || !buffers.segments.get().length) continue;
        const programConfiguration = buffers.programConfigurations.get(layer.id);

        const isSDF = isText || bucket.sdfIcons;

        const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;
        const transformed = pitchWithMap || tr.pitch !== 0;

        const size = symbolSize.evaluateSizeForZoom(sizeData, tr.zoom);

        let texSize: [number, number];
        let texSizeIcon: [number, number] = [0, 0];
        let atlasTexture;
        let atlasInterpolation;
        let atlasTextureIcon = null;
        let atlasInterpolationIcon;
        if (isText) {
            atlasTexture = tile.glyphAtlasTexture;
            atlasInterpolation = gl.LINEAR;
            texSize = tile.glyphAtlasTexture.size;
            if (bucket.iconsInText) {
                texSizeIcon = tile.imageAtlasTexture.size;
                atlasTextureIcon = tile.imageAtlasTexture;
                const zoomDependentSize = sizeData.kind === 'composite' || sizeData.kind === 'camera';
                atlasInterpolationIcon = transformed || painter.options.rotating || painter.options.zooming || zoomDependentSize ? gl.LINEAR : gl.NEAREST;
            }
        } else {
            const iconScaled = layer.layout.get('icon-size').constantOr(0) !== 1 || bucket.iconsNeedLinear;
            atlasTexture = tile.imageAtlasTexture;
            atlasInterpolation = isSDF || painter.options.rotating || painter.options.zooming || iconScaled || transformed ?
                gl.LINEAR :
                gl.NEAREST;
            texSize = tile.imageAtlasTexture.size;
        }

        const bucketIsGlobeProjection = bucket.projection.name === 'globe';
        const cameraUpVector = bucketIsGlobeProjection ? globeCameraUp : mercatorCameraUp;
        const globeToMercator =  bucketIsGlobeProjection ? globeToMercatorTransition(tr.zoom) : 0.0;
        const tileMatrix = getSymbolTileProjectionMatrix(coord, bucket.getProjection(), tr);

        const s = tr.calculatePixelsToTileUnitsMatrix(tile);
        const labelPlaneMatrixRendering = symbolProjection.getLabelPlaneMatrixForRendering(tileMatrix, tile.tileID.canonical, pitchWithMap, rotateWithMap, tr, bucket.getProjection(), s);
        // labelPlaneMatrixInv is used for converting vertex pos to tile coordinates needed for sampling elevation.
        const labelPlaneMatrixInv = painter.terrain && pitchWithMap && alongLine ? mat4.invert(mat4.create(), labelPlaneMatrixRendering) : identityMat4;
        const glCoordMatrix = symbolProjection.getGlCoordMatrix(tileMatrix, tile.tileID.canonical, pitchWithMap, rotateWithMap, tr, bucket.getProjection(), s);

        const hasVariableAnchors = variablePlacement && bucket.hasTextData();
        const updateTextFitIcon = layer.layout.get('icon-text-fit') !== 'none' &&
            hasVariableAnchors &&
            bucket.hasIconData();

        if (alongLine) {
            const elevation = tr.elevation;
            const getElevation = elevation ? elevation.getAtTileOffsetFunc(coord, tr.center.lat, tr.worldSize, bucket.getProjection()) : (_ => [0, 0, 0]);
            const labelPlaneMatrixPlacement = symbolProjection.getLabelPlaneMatrixForPlacement(tileMatrix, tile.tileID.canonical, pitchWithMap, rotateWithMap, tr, bucket.getProjection(), s);

            symbolProjection.updateLineLabels(bucket, tileMatrix, painter, isText, labelPlaneMatrixPlacement, glCoordMatrix, pitchWithMap, keepUpright, getElevation, coord);
        }

        const projectedPosOnLabelSpace = alongLine || (isText && variablePlacement) || updateTextFitIcon;
        const matrix = painter.translatePosMatrix(tileMatrix, tile, translate, translateAnchor);
        const uLabelPlaneMatrix = projectedPosOnLabelSpace ? identityMat4 : labelPlaneMatrixRendering;
        const uglCoordMatrix = painter.translatePosMatrix(glCoordMatrix, tile, translate, translateAnchor, true);
        const invMatrix = bucket.getProjection().createInversionMatrix(tr, coord.canonical);

        const baseDefines = ([]: any);
        if (painter.terrain && pitchWithMap) {
            baseDefines.push('PITCH_WITH_MAP_TERRAIN');
        }
        if (bucketIsGlobeProjection) {
            baseDefines.push('PROJECTION_GLOBE_VIEW');
        }
        if (projectedPosOnLabelSpace) {
            baseDefines.push('PROJECTED_POS_ON_VIEWPORT');
        }

        const hasHalo = isSDF && layer.paint.get(isText ? 'text-halo-width' : 'icon-halo-width').constantOr(1) !== 0;

        let uniformValues;
        if (isSDF) {
            if (!bucket.iconsInText) {
                uniformValues = symbolSDFUniformValues(sizeData.kind, size, rotateInShader, pitchWithMap, painter,
                    matrix, uLabelPlaneMatrix, uglCoordMatrix, isText, texSize, true, coord, globeToMercator, mercatorCenter, invMatrix, cameraUpVector, bucket.getProjection());
            } else {
                uniformValues = symbolTextAndIconUniformValues(sizeData.kind, size, rotateInShader, pitchWithMap, painter,
                    matrix, uLabelPlaneMatrix, uglCoordMatrix, texSize, texSizeIcon, coord, globeToMercator, mercatorCenter, invMatrix, cameraUpVector, bucket.getProjection());
            }
        } else {
            uniformValues = symbolIconUniformValues(sizeData.kind, size, rotateInShader, pitchWithMap, painter, matrix,
                uLabelPlaneMatrix, uglCoordMatrix, isText, texSize, coord, globeToMercator, mercatorCenter, invMatrix, cameraUpVector, bucket.getProjection());
        }

        const program = painter.useProgram(getSymbolProgramName(isSDF, isText, bucket), programConfiguration, baseDefines);

        const state = {
            program,
            buffers,
            uniformValues,
            atlasTexture,
            atlasTextureIcon,
            atlasInterpolation,
            atlasInterpolationIcon,
            isSDF,
            hasHalo,
            tile,
            labelPlaneMatrixInv
        };

        if (hasSortKey && bucket.canOverlap) {
            sortFeaturesByKey = true;
            const oldSegments = buffers.segments.get();
            for (const segment of oldSegments) {
                tileRenderState.push({
                    segments: new SegmentVector([segment]),
                    sortKey: ((segment.sortKey: any): number),
                    state
                });
            }
        } else {
            tileRenderState.push({
                segments: buffers.segments,
                sortKey: 0,
                state
            });
        }
    }

    if (sortFeaturesByKey) {
        tileRenderState.sort((a, b) => a.sortKey - b.sortKey);
    }

    for (const segmentState of tileRenderState) {
        const state = segmentState.state;
        if (painter.terrain) {
            const options = {
                useDepthForOcclusion: !isGlobeProjection,
                labelPlaneMatrixInv: state.labelPlaneMatrixInv
            };
            painter.terrain.setupElevationDraw(state.tile, state.program, options);
        }
        context.activeTexture.set(gl.TEXTURE0);
        state.atlasTexture.bind(state.atlasInterpolation, gl.CLAMP_TO_EDGE);
        if (state.atlasTextureIcon) {
            context.activeTexture.set(gl.TEXTURE1);
            if (state.atlasTextureIcon) {
                state.atlasTextureIcon.bind(state.atlasInterpolationIcon, gl.CLAMP_TO_EDGE);
            }
        }

        if (state.isSDF) {
            const uniformValues = ((state.uniformValues: any): UniformValues<SymbolSDFUniformsType>);
            if (state.hasHalo) {
                uniformValues['u_is_halo'] = 1;
                drawSymbolElements(state.buffers, segmentState.segments, layer, painter, state.program, depthMode, stencilMode, colorMode, uniformValues);
            }
            uniformValues['u_is_halo'] = 0;
        }
        drawSymbolElements(state.buffers, segmentState.segments, layer, painter, state.program, depthMode, stencilMode, colorMode, state.uniformValues);
    }
}

function drawSymbolElements(buffers, segments, layer, painter, program, depthMode, stencilMode, colorMode, uniformValues) {
    const context = painter.context;
    const gl = context.gl;
    program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
        uniformValues, layer.id, buffers.layoutVertexBuffer,
        buffers.indexBuffer, segments, layer.paint,
        painter.transform.zoom, buffers.programConfigurations.get(layer.id),
        buffers.dynamicLayoutVertexBuffer, buffers.opacityVertexBuffer, buffers.globeExtVertexBuffer);
}
