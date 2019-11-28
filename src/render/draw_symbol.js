// @flow

import Point from '@mapbox/point-geometry';
import drawCollisionDebug from './draw_collision_debug';

import SegmentVector from '../data/segment';
import pixelsToTileUnits from '../source/pixels_to_tile_units';
import * as symbolProjection from '../symbol/projection';
import * as symbolSize from '../symbol/symbol_size';
import {mat4} from 'gl-matrix';
const identityMat4 = mat4.identity(new Float32Array(16));
import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {addDynamicAttributes} from '../data/bucket/symbol_bucket';

import {getAnchorAlignment, WritingMode} from '../symbol/shaping';
import ONE_EM from '../symbol/one_em';
import {evaluateVariableOffset} from '../symbol/symbol_layout';

import {
    symbolIconUniformValues,
    symbolSDFUniformValues,
    symbolTextAndIconUniformValues
} from './program/symbol_program';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import type SymbolBucket, {SymbolBuffers} from '../data/bucket/symbol_bucket';
import type Texture from '../render/texture';
import type {OverscaledTileID} from '../source/tile_id';
import type {UniformValues} from './uniform_binding';
import type {SymbolSDFUniformsType} from '../render/program/symbol_program';
import type {CrossTileID, VariableOffset} from '../symbol/placement';

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
        hasHalo: boolean
    }
};

function drawSymbols(painter: Painter, sourceCache: SourceCache, layer: SymbolStyleLayer, coords: Array<OverscaledTileID>, variableOffsets: {[CrossTileID]: VariableOffset}) {
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

function calculateVariableRenderShift(anchor, width, height, textOffset, textBoxScale, renderTextSize): Point {
    const {horizontalAlign, verticalAlign} = getAnchorAlignment(anchor);
    const shiftX = -(horizontalAlign - 0.5) * width;
    const shiftY = -(verticalAlign - 0.5) * height;
    const variableOffset = evaluateVariableOffset(anchor, textOffset);
    return new Point(
        (shiftX / textBoxScale + variableOffset[0]) * renderTextSize,
        (shiftY / textBoxScale + variableOffset[1]) * renderTextSize
    );
}

function updateVariableAnchors(coords, painter, layer, sourceCache, rotationAlignment, pitchAlignment, variableOffsets) {
    const tr = painter.transform;
    const rotateWithMap = rotationAlignment === 'map';
    const pitchWithMap = pitchAlignment === 'map';

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket: SymbolBucket = (tile.getBucket(layer): any);
        if (!bucket || !bucket.text || !bucket.text.segments.get().length) continue;

        const sizeData = bucket.textSizeData;
        const size = symbolSize.evaluateSizeForZoom(sizeData, tr.zoom);

        const pixelToTileScale = pixelsToTileUnits(tile, 1, painter.transform.zoom);
        const labelPlaneMatrix = symbolProjection.getLabelPlaneMatrix(coord.posMatrix, pitchWithMap, rotateWithMap, painter.transform, pixelToTileScale);
        const updateTextFitIcon = layer.layout.get('icon-text-fit') !== 'none' &&  bucket.hasIconData();

        if (size) {
            const tileScale = Math.pow(2, tr.zoom - tile.tileID.overscaledZ);
            updateVariableAnchorsForBucket(bucket, rotateWithMap, pitchWithMap, variableOffsets, symbolSize,
                                  tr, labelPlaneMatrix, coord.posMatrix, tileScale, size, updateTextFitIcon);
        }
    }
}

function updateVariableAnchorsForBucket(bucket, rotateWithMap, pitchWithMap, variableOffsets, symbolSize,
                               transform, labelPlaneMatrix, posMatrix, tileScale, size, updateTextFitIcon) {
    const placedSymbols = bucket.text.placedSymbolArray;
    const dynamicTextLayoutVertexArray = bucket.text.dynamicLayoutVertexArray;
    const dynamicIconLayoutVertexArray = bucket.icon.dynamicLayoutVertexArray;
    const placedTextShifts = {};

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
            const tileAnchor = new Point(symbol.anchorX, symbol.anchorY);
            const projectedAnchor = symbolProjection.project(tileAnchor, pitchWithMap ? posMatrix : labelPlaneMatrix);
            const perspectiveRatio = 0.5 + 0.5 * (transform.cameraToCenterDistance / projectedAnchor.signedDistanceFromCamera);
            let renderTextSize = symbolSize.evaluateSizeForFeature(bucket.textSizeData, size, symbol) * perspectiveRatio / ONE_EM;
            if (pitchWithMap) {
                // Go from size in pixels to equivalent size in tile units
                renderTextSize *= bucket.tilePixelRatio / tileScale;
            }

            const {width, height, anchor, textOffset, textBoxScale} = variableOffset;

            const shift = calculateVariableRenderShift(
                anchor, width, height, textOffset, textBoxScale, renderTextSize);

            // Usual case is that we take the projected anchor and add the pixel-based shift
            // calculated above. In the (somewhat weird) case of pitch-aligned text, we add an equivalent
            // tile-unit based shift to the anchor before projecting to the label plane.
            const shiftedAnchor = pitchWithMap ?
                symbolProjection.project(tileAnchor.add(shift), labelPlaneMatrix).point :
                projectedAnchor.point.add(rotateWithMap ?
                    shift.rotate(-transform.angle) :
                    shift);

            const angle = (bucket.allowVerticalPlacement && symbol.placedOrientation === WritingMode.vertical) ? Math.PI / 2 : 0;
            for (let g = 0; g < symbol.numGlyphs; g++) {
                addDynamicAttributes(dynamicTextLayoutVertexArray, shiftedAnchor, angle);
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
                        addDynamicAttributes(dynamicIconLayoutVertexArray, shift.shiftedAnchor, shift.angle);
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

    const sortFeaturesByKey = layer.layout.get('symbol-sort-key').constantOr(1) !== undefined;

    const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);

    let program;
    let size;
    const variablePlacement = layer.layout.get('text-variable-anchor');

    const tileRenderState: Array<SymbolTileRenderState> = [];

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket: SymbolBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;
        const buffers = isText ? bucket.text : bucket.icon;
        if (!buffers || !buffers.segments.get().length) continue;
        const programConfiguration = buffers.programConfigurations.get(layer.id);

        const isSDF = isText || bucket.sdfIcons;

        const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;
        const transformed = pitchWithMap || tr.pitch !== 0;

        if (!program) {
            program = painter.useProgram(getSymbolProgramName(isSDF, isText, bucket), programConfiguration);
            size = symbolSize.evaluateSizeForZoom(sizeData, tr.zoom);
        }

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

        const s = pixelsToTileUnits(tile, 1, painter.transform.zoom);
        const labelPlaneMatrix = symbolProjection.getLabelPlaneMatrix(coord.posMatrix, pitchWithMap, rotateWithMap, painter.transform, s);
        const glCoordMatrix = symbolProjection.getGlCoordMatrix(coord.posMatrix, pitchWithMap, rotateWithMap, painter.transform, s);

        const hasVariableAnchors = variablePlacement && bucket.hasTextData();
        const updateTextFitIcon = layer.layout.get('icon-text-fit') !== 'none' &&
            hasVariableAnchors &&
            bucket.hasIconData();

        if (alongLine) {
            symbolProjection.updateLineLabels(bucket, coord.posMatrix, painter, isText, labelPlaneMatrix, glCoordMatrix, pitchWithMap, keepUpright);
        }

        const matrix = painter.translatePosMatrix(coord.posMatrix, tile, translate, translateAnchor),
            uLabelPlaneMatrix = (alongLine || (isText && variablePlacement) || updateTextFitIcon) ? identityMat4 : labelPlaneMatrix,
            uglCoordMatrix = painter.translatePosMatrix(glCoordMatrix, tile, translate, translateAnchor, true);

        const hasHalo = isSDF && layer.paint.get(isText ? 'text-halo-width' : 'icon-halo-width').constantOr(1) !== 0;

        let uniformValues;
        if (isSDF) {
            if (!bucket.iconsInText) {
                uniformValues = symbolSDFUniformValues(sizeData.kind,
                size, rotateInShader, pitchWithMap, painter, matrix,
                uLabelPlaneMatrix, uglCoordMatrix, isText, texSize, true);
            } else {
                uniformValues = symbolTextAndIconUniformValues(sizeData.kind,
                size, rotateInShader, pitchWithMap, painter, matrix,
                uLabelPlaneMatrix, uglCoordMatrix, texSize, texSizeIcon);
            }
        } else {
            uniformValues = symbolIconUniformValues(sizeData.kind,
                size, rotateInShader, pitchWithMap, painter, matrix,
                uLabelPlaneMatrix, uglCoordMatrix, isText, texSize);
        }

        const state = {
            program,
            buffers,
            uniformValues,
            atlasTexture,
            atlasTextureIcon,
            atlasInterpolation,
            atlasInterpolationIcon,
            isSDF,
            hasHalo
        };

        if (sortFeaturesByKey) {
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
        buffers.dynamicLayoutVertexBuffer, buffers.opacityVertexBuffer);
}
