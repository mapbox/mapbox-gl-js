import Point from '@mapbox/point-geometry';
import drawCollisionDebug from './draw_collision_debug';
import SegmentVector from '../data/segment';
import * as symbolProjection from '../symbol/projection';
import * as symbolSize from '../symbol/symbol_size';
import {mat4, vec3, vec4} from 'gl-matrix';
import {clamp} from '../util/util';
const identityMat4 = mat4.create();
import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {addDynamicAttributes} from '../data/bucket/symbol_bucket';
import {getAnchorAlignment, WritingMode} from '../symbol/shaping';
import ONE_EM from '../symbol/one_em';
import {evaluateVariableOffset} from '../symbol/symbol_layout';
import {
    mercatorXfromLng,
    mercatorYfromLat
} from '../geo/mercator_coordinate';
import {globeToMercatorTransition} from '../geo/projection/globe_util';
import {
    symbolUniformValues
} from './program/symbol_program';
import {getSymbolTileProjectionMatrix} from '../geo/projection/projection_util';

import type Tile from '../source/tile';
import type Transform from '../geo/transform';
import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import type SymbolBucket from '../data/bucket/symbol_bucket';
import type {SymbolBuffers} from '../data/bucket/symbol_bucket';
import type Texture from '../render/texture';
import type ColorMode from '../gl/color_mode';
import type {OverscaledTileID} from '../source/tile_id';
import type {UniformValues} from './uniform_binding';
import type {SymbolUniformsType} from '../render/program/symbol_program';
import type {CrossTileID, VariableOffset} from '../symbol/placement';
import type {InterpolatedSize} from '../symbol/symbol_size';

export default drawSymbols;

type SymbolTileRenderState = {
    segments: SegmentVector;
    sortKey: number;
    state: {
        program: any;
        buffers: SymbolBuffers;
        uniformValues: any;
        atlasTexture: Texture | null;
        atlasTextureIcon: Texture | null;
        atlasInterpolation: any;
        atlasInterpolationIcon: any;
        isSDF: boolean;
        hasHalo: boolean;
        tile: Tile;
        labelPlaneMatrixInv: mat4 | null | undefined;
    } | null;
};

type Alignment = 'auto' | 'map' | 'viewport';

function drawSymbols(painter: Painter, sourceCache: SourceCache, layer: SymbolStyleLayer, coords: Array<OverscaledTileID>, variableOffsets: Partial<Record<CrossTileID, VariableOffset>>) {
    if (painter.renderPass !== 'translucent') return;

    // Disable the stencil test so that labels aren't clipped to tile boundaries.
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();
    const variablePlacement = layer.layout.get('text-variable-anchor');
    const textSizeScaleRange = layer.layout.get('text-size-scale-range');
    const textScaleFactor = clamp(painter.scaleFactor, textSizeScaleRange[0], textSizeScaleRange[1]);

    //Compute variable-offsets before painting since icons and text data positioning
    //depend on each other in this case.
    if (variablePlacement) {
        updateVariableAnchors(coords, painter, layer, sourceCache,

            layer.layout.get('text-rotation-alignment'),
            layer.layout.get('text-pitch-alignment'),
            variableOffsets,
            textScaleFactor
        );
    }

    const areIconsVisible = layer.paint.get('icon-opacity').constantOr(1) !== 0;

    const areTextsVisible = layer.paint.get('text-opacity').constantOr(1) !== 0;

    // Support of ordering of symbols and texts comes with possible sacrificing of performance
    // because of switching of shader program for every render state from icon to SDF.
    // To address this problem, let's use one-phase rendering only when sort key provided

    if (layer.layout.get('symbol-sort-key').constantOr(1) !== undefined && (areIconsVisible || areTextsVisible)) {
        drawLayerSymbols(painter, sourceCache, layer, coords, stencilMode, colorMode);
    } else {
        if (areIconsVisible) {
            drawLayerSymbols(painter, sourceCache, layer, coords, stencilMode, colorMode, {onlyIcons: true});
        }
        if (areTextsVisible) {
            drawLayerSymbols(painter, sourceCache, layer, coords, stencilMode, colorMode, {onlyText: true});
        }
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
    const viewToEcef = mat4.multiply([] as any, viewMatrix, transform.globeMatrix);
    mat4.invert(viewToEcef, viewToEcef);

    const cameraUpVector: vec3 = [0, 0, 0];
    const up: vec4 = [0, 1, 0, 0];
    vec4.transformMat4(up, up, viewToEcef);
    cameraUpVector[0] = up[0];
    cameraUpVector[1] = up[1];
    cameraUpVector[2] = up[2];
    vec3.normalize(cameraUpVector, cameraUpVector);

    return cameraUpVector;
}

function calculateVariableRenderShift(
    {
        width,
        height,
        anchor,
        textOffset,
        textScale,
    }: VariableOffset,
    renderTextSize: number,
): Point {
    const {horizontalAlign, verticalAlign} = getAnchorAlignment(anchor);
    const shiftX = -(horizontalAlign - 0.5) * width;
    const shiftY = -(verticalAlign - 0.5) * height;
    const variableOffset = evaluateVariableOffset(anchor, textOffset);
    return new Point(
        (shiftX / textScale + variableOffset[0]) * renderTextSize,
        (shiftY / textScale + variableOffset[1]) * renderTextSize
    );
}

function updateVariableAnchors(coords: Array<OverscaledTileID>, painter: Painter, layer: SymbolStyleLayer, sourceCache: SourceCache, rotationAlignment: Alignment, pitchAlignment: Alignment, variableOffsets: Partial<Record<CrossTileID, VariableOffset>>, textScaleFactor: number) {
    const tr = painter.transform;
    const rotateWithMap = rotationAlignment === 'map';
    const pitchWithMap = pitchAlignment === 'map';

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket: SymbolBucket = (tile.getBucket(layer) as any);
        if (!bucket || !bucket.text || !bucket.text.segments.get().length) {
            continue;
        }

        const sizeData = bucket.textSizeData;
        const size = symbolSize.evaluateSizeForZoom(sizeData, tr.zoom, textScaleFactor);
        const tileMatrix = getSymbolTileProjectionMatrix(coord, bucket.getProjection(), tr);

        const pixelsToTileUnits = tr.calculatePixelsToTileUnitsMatrix(tile);
        const labelPlaneMatrix = symbolProjection.getLabelPlaneMatrixForRendering(tileMatrix, tile.tileID.canonical, pitchWithMap, rotateWithMap, tr, bucket.getProjection(), pixelsToTileUnits);
        const updateTextFitIcon = bucket.hasIconTextFit() && bucket.hasIconData();

        if (size) {
            const tileScale = Math.pow(2, tr.zoom - tile.tileID.overscaledZ);
            updateVariableAnchorsForBucket(bucket, rotateWithMap, pitchWithMap, variableOffsets, symbolSize,
                tr, labelPlaneMatrix as Float32Array, coord, tileScale, size, updateTextFitIcon);
        }
    }
}

// @ts-expect-error - TS2502 - 'symbolSize' is referenced directly or indirectly in its own type annotation.
function updateVariableAnchorsForBucket(bucket: SymbolBucket, rotateWithMap: boolean, pitchWithMap: boolean, variableOffsets: Partial<Record<CrossTileID, VariableOffset>>, symbolSize: typeof symbolSize, transform: Transform, labelPlaneMatrix: Float32Array, coord: OverscaledTileID, tileScale: number, size: InterpolatedSize, updateTextFitIcon: boolean) {
    const placedSymbols = bucket.text.placedSymbolArray;
    const dynamicTextLayoutVertexArray = bucket.text.dynamicLayoutVertexArray;
    const dynamicIconLayoutVertexArray = bucket.icon.dynamicLayoutVertexArray;
    const placedTextShifts: Record<string, any> = {};
    const projection = bucket.getProjection();
    const tileMatrix = getSymbolTileProjectionMatrix(coord, projection, transform);
    const elevation = transform.elevation;
    const metersToTile = projection.upVectorScale(coord.canonical, transform.center.lat, transform.worldSize).metersToTile;

    dynamicTextLayoutVertexArray.clear();
    for (let s = 0; s < placedSymbols.length; s++) {
        const symbol = placedSymbols.get(s);
        const {tileAnchorX, tileAnchorY, numGlyphs} = symbol;
        const skipOrientation = bucket.allowVerticalPlacement && !symbol.placedOrientation;
        const variableOffset = (!symbol.hidden && symbol.crossTileID && !skipOrientation) ? variableOffsets[symbol.crossTileID] : null;

        if (!variableOffset) {
            // These symbols are from a justification that is not being used, or a label that wasn't placed
            // so we don't need to do the extra math to figure out what incremental shift to apply.
            symbolProjection.hideGlyphs(numGlyphs, dynamicTextLayoutVertexArray);

        } else {
            let dx = 0, dy = 0, dz = 0;
            if (elevation) {
                const h = elevation ? elevation.getAtTileOffset(coord, tileAnchorX, tileAnchorY) : 0.0;
                const [ux, uy, uz] = projection.upVector(coord.canonical, tileAnchorX, tileAnchorY);
                dx = h * ux * metersToTile;
                dy = h * uy * metersToTile;
                dz = h * uz * metersToTile;
            }
            let [x, y, z, w] = symbolProjection.project(
                symbol.projectedAnchorX + dx,
                symbol.projectedAnchorY + dy,
                symbol.projectedAnchorZ + dz,
                pitchWithMap ? tileMatrix : labelPlaneMatrix);

            const perspectiveRatio = symbolProjection.getPerspectiveRatio(transform.getCameraToCenterDistance(projection), w);
            let renderTextSize = symbolSize.evaluateSizeForFeature(bucket.textSizeData, size, symbol) * perspectiveRatio / ONE_EM;
            if (pitchWithMap) {
                // Go from size in pixels to equivalent size in tile units
                renderTextSize *= bucket.tilePixelRatio / tileScale;
            }

            const shift = calculateVariableRenderShift(variableOffset, renderTextSize);

            // Usual case is that we take the projected anchor and add the pixel-based shift
            // calculated above. In the (somewhat weird) case of pitch-aligned text, we add an equivalent
            // tile-unit based shift to the anchor before projecting to the label plane.
            if (pitchWithMap) {
                ({x, y, z} = projection.projectTilePoint(tileAnchorX + shift.x, tileAnchorY + shift.y, coord.canonical));
                [x, y, z] = symbolProjection.project(x + dx, y + dy, z + dz, labelPlaneMatrix);

            } else {
                if (rotateWithMap) shift._rotate(-transform.angle);
                x += shift.x;
                y += shift.y;
                z = 0;
            }

            const angle = (bucket.allowVerticalPlacement && symbol.placedOrientation === WritingMode.vertical) ? Math.PI / 2 : 0;
            for (let g = 0; g < numGlyphs; g++) {
                addDynamicAttributes(dynamicTextLayoutVertexArray, x, y, z, angle);
            }
            //Only offset horizontal text icons
            if (updateTextFitIcon && symbol.associatedIconIndex >= 0) {
                placedTextShifts[symbol.associatedIconIndex] = {x, y, z, angle};
            }
        }
    }

    if (updateTextFitIcon) {
        dynamicIconLayoutVertexArray.clear();
        const placedIcons = bucket.icon.placedSymbolArray;
        for (let i = 0; i < placedIcons.length; i++) {
            const placedIcon = placedIcons.get(i);
            const {numGlyphs} = placedIcon;
            const shift = placedTextShifts[i];

            if (placedIcon.hidden || !shift) {
                symbolProjection.hideGlyphs(numGlyphs, dynamicIconLayoutVertexArray);
            } else {
                const {x, y, z, angle} = shift;
                for (let g = 0; g < numGlyphs; g++) {
                    addDynamicAttributes(dynamicIconLayoutVertexArray, x, y, z, angle);
                }
            }
        }
        bucket.icon.dynamicLayoutVertexBuffer.updateData(dynamicIconLayoutVertexArray);
    }
    bucket.text.dynamicLayoutVertexBuffer.updateData(dynamicTextLayoutVertexArray);
}

type DrawLayerSymbolsOptions = {
    onlyIcons?: boolean;
    onlyText?: boolean;
};

function drawLayerSymbols(
    painter: Painter,
    sourceCache: SourceCache,
    layer: SymbolStyleLayer,
    coords: Array<OverscaledTileID>,
    stencilMode: StencilMode,
    colorMode: ColorMode,
    options: DrawLayerSymbolsOptions = {},
) {
    const iconTranslate = layer.paint.get('icon-translate');
    const textTranslate = layer.paint.get('text-translate');
    const iconTranslateAnchor = layer.paint.get('icon-translate-anchor');
    const textTranslateAnchor = layer.paint.get('text-translate-anchor');
    const iconRotationAlignment = layer.layout.get('icon-rotation-alignment');
    const textRotationAlignment = layer.layout.get('text-rotation-alignment');
    const iconPitchAlignment = layer.layout.get('icon-pitch-alignment');
    const textPitchAlignment = layer.layout.get('text-pitch-alignment');
    const iconKeepUpright = layer.layout.get('icon-keep-upright');
    const textKeepUpright = layer.layout.get('text-keep-upright');
    const iconSaturation = layer.paint.get('icon-color-saturation');
    const iconContrast = layer.paint.get('icon-color-contrast');
    const iconBrightnessMin = layer.paint.get('icon-color-brightness-min');
    const iconBrightnessMax = layer.paint.get('icon-color-brightness-max');
    const elevationFromSea = layer.layout.get('symbol-elevation-reference') === 'sea';

    const context = painter.context;
    const gl = context.gl;
    const tr = painter.transform;

    const iconRotateWithMap = iconRotationAlignment === 'map';
    const textRotateWithMap = textRotationAlignment === 'map';
    const iconPitchWithMap = iconPitchAlignment === 'map';
    const textPitchWithMap = textPitchAlignment === 'map';

    const hasSortKey = layer.layout.get('symbol-sort-key').constantOr(1) !== undefined;
    let sortFeaturesByKey = false;

    const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
    const mercatorCenter: [number, number] = [
        mercatorXfromLng(tr.center.lng),
        mercatorYfromLat(tr.center.lat)
    ];
    const variablePlacement = layer.layout.get('text-variable-anchor');
    const isGlobeProjection = tr.projection.name === 'globe';
    const tileRenderState: Array<SymbolTileRenderState> = [];

    const mercatorCameraUp: [number, number, number] = [0, -1, 0];

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);

        const bucket: SymbolBucket = (tile.getBucket(layer) as any);

        if (!bucket) continue;
        // Allow rendering of buckets built for globe projection in mercator mode
        // until the substitute tile has been loaded
        if (bucket.projection.name === 'mercator' && isGlobeProjection) {
            continue;
        }

        if (bucket.fullyClipped) continue;

        const bucketIsGlobeProjection = bucket.projection.name === 'globe';
        const globeToMercator = bucketIsGlobeProjection ? globeToMercatorTransition(tr.zoom) : 0.0;
        const tileMatrix = getSymbolTileProjectionMatrix(coord, bucket.getProjection(), tr);

        const s = tr.calculatePixelsToTileUnitsMatrix(tile);

        const hasVariableAnchors = variablePlacement && bucket.hasTextData();
        const updateTextFitIcon = bucket.hasIconTextFit() &&
            hasVariableAnchors &&
            bucket.hasIconData();

        const invMatrix = bucket.getProjection().createInversionMatrix(tr, coord.canonical);

        const setOcclusionDefines = (defines:any[]) => {
            // Globe or orthographic - no depth occlusion needed
            if (!tr.depthOcclusionForSymbolsAndCircles) {
                return;
            }

            if (!layer.hasInitialOcclusionOpacityProperties) {
                // Occlusion against terrain only
                if (painter.terrain) {
                    defines.push('DEPTH_D24');
                    defines.push('DEPTH_OCCLUSION');
                }
            } else {
                // Occlusion enabled
                defines.push('DEPTH_D24');
                defines.push('DEPTH_OCCLUSION');
            }
        };

        const getIconState = () => {
            const alongLine = iconRotateWithMap && layer.layout.get('symbol-placement') !== 'point';

            const baseDefines = ([] as any);

            setOcclusionDefines(baseDefines);

            const projectedPosOnLabelSpace = alongLine || updateTextFitIcon;

            const transitionProgress = layer.paint.get('icon-image-cross-fade').constantOr(0.0);
            if (painter.terrainRenderModeElevated() && iconPitchWithMap) {
                baseDefines.push('PITCH_WITH_MAP_TERRAIN');
            }
            if (bucketIsGlobeProjection) {
                baseDefines.push('PROJECTION_GLOBE_VIEW');
                if (projectedPosOnLabelSpace) {
                    baseDefines.push('PROJECTED_POS_ON_VIEWPORT');
                }
            }
            if (transitionProgress > 0.0) {
                baseDefines.push('ICON_TRANSITION');
            }
            if (bucket.icon.zOffsetVertexBuffer) {
                baseDefines.push('Z_OFFSET');
            }

            if (iconSaturation !== 0 || iconContrast !== 0 || iconBrightnessMin !== 0 || iconBrightnessMax !== 1) {
                baseDefines.push('COLOR_ADJUSTMENT');
            }

            if (bucket.sdfIcons) {
                baseDefines.push('RENDER_SDF');
            }

            const programConfiguration = bucket.icon.programConfigurations.get(layer.id);
            const program = painter.getOrCreateProgram('symbol', {config: programConfiguration, defines: baseDefines});

            const texSize: [number, number] = tile.imageAtlasTexture ? tile.imageAtlasTexture.size : [0, 0];
            const sizeData = bucket.iconSizeData;
            const size = symbolSize.evaluateSizeForZoom(sizeData, tr.zoom);
            const transformed = iconPitchWithMap || tr.pitch !== 0;

            const labelPlaneMatrixRendering = symbolProjection.getLabelPlaneMatrixForRendering(tileMatrix, tile.tileID.canonical, iconPitchWithMap, iconRotateWithMap, tr, bucket.getProjection(), s);
            // labelPlaneMatrixInv is used for converting vertex pos to tile coordinates needed for sampling elevation.
            const glCoordMatrix = symbolProjection.getGlCoordMatrix(tileMatrix, tile.tileID.canonical, iconPitchWithMap, iconRotateWithMap, tr, bucket.getProjection(), s);

            const uglCoordMatrix = painter.translatePosMatrix(glCoordMatrix, tile, iconTranslate, iconTranslateAnchor, true);

            const matrix = painter.translatePosMatrix(tileMatrix, tile, iconTranslate, iconTranslateAnchor);
            const uLabelPlaneMatrix = projectedPosOnLabelSpace ? identityMat4 : labelPlaneMatrixRendering;
            const rotateInShader = iconRotateWithMap && !iconPitchWithMap && !alongLine;

            let globeCameraUp = mercatorCameraUp;
            if ((isGlobeProjection || tr.mercatorFromTransition) && !iconRotateWithMap) {
                // Each symbol rotating with the viewport requires per-instance information about
                // how to align with the viewport. In 2D case rotation is shared between all of the symbols and
                // hence embedded in the label plane matrix but in globe view this needs to be computed at runtime.
                // Camera up vector together with surface normals can be used to find the correct orientation for each symbol.
                globeCameraUp = computeGlobeCameraUp(tr);
            }

            const cameraUpVector = bucketIsGlobeProjection ? globeCameraUp : mercatorCameraUp;

            const colorAdjustmentMatrix = layer.getColorAdjustmentMatrix(iconSaturation, iconContrast, iconBrightnessMin, iconBrightnessMax);
            const uniformValues = symbolUniformValues(sizeData.kind, size, rotateInShader, iconPitchWithMap, painter,
                matrix, uLabelPlaneMatrix, uglCoordMatrix, elevationFromSea, false, texSize, [0, 0], true, coord, globeToMercator, mercatorCenter, invMatrix, cameraUpVector, bucket.getProjection(), colorAdjustmentMatrix, transitionProgress);

            const atlasTexture = tile.imageAtlasTexture ? tile.imageAtlasTexture : null;

            const iconScaled = layer.layout.get('icon-size').constantOr(0) !== 1 || bucket.iconsNeedLinear;
            const atlasInterpolation = bucket.sdfIcons || painter.options.rotating || painter.options.zooming || iconScaled || transformed ? gl.LINEAR : gl.NEAREST;

            const hasHalo = bucket.sdfIcons && layer.paint.get('icon-halo-width').constantOr(1) !== 0;
            const labelPlaneMatrixInv = painter.terrain && iconPitchWithMap && alongLine ? mat4.invert(mat4.create(), labelPlaneMatrixRendering) : identityMat4;

            // Line label rotation happens in `updateLineLabels`
            // Pitched point labels are automatically rotated by the labelPlaneMatrix projection
            // Unpitched point labels need to have their rotation applied after projection

            if (alongLine && bucket.icon) {
                const elevation = tr.elevation;
                const getElevation = elevation ? elevation.getAtTileOffsetFunc(coord, tr.center.lat, tr.worldSize, bucket.getProjection()) : null;
                const labelPlaneMatrixPlacement = symbolProjection.getLabelPlaneMatrixForPlacement(tileMatrix, tile.tileID.canonical, iconPitchWithMap, iconRotateWithMap, tr, bucket.getProjection(), s);

                symbolProjection.updateLineLabels(bucket, tileMatrix, painter, false, labelPlaneMatrixPlacement, glCoordMatrix, iconPitchWithMap, iconKeepUpright, getElevation, coord);
            }

            return {
                program,
                buffers: bucket.icon,
                uniformValues,
                atlasTexture,
                atlasTextureIcon: null,
                atlasInterpolation,
                atlasInterpolationIcon: null,
                isSDF: bucket.sdfIcons,
                hasHalo,
                tile,
                labelPlaneMatrixInv,
            };
        };

        const getTextState = () => {
            const alongLine = textRotateWithMap && layer.layout.get('symbol-placement') !== 'point';
            const baseDefines = ([] as any);
            const projectedPosOnLabelSpace = alongLine || variablePlacement || updateTextFitIcon;

            if (painter.terrainRenderModeElevated() && textPitchWithMap) {
                baseDefines.push('PITCH_WITH_MAP_TERRAIN');
            }
            if (bucketIsGlobeProjection) {
                baseDefines.push('PROJECTION_GLOBE_VIEW');
                if (projectedPosOnLabelSpace) {
                    baseDefines.push('PROJECTED_POS_ON_VIEWPORT');
                }
            }
            if (bucket.text.zOffsetVertexBuffer) {
                baseDefines.push('Z_OFFSET');
            }

            if (bucket.iconsInText) {
                baseDefines.push('RENDER_TEXT_AND_SYMBOL');
            }

            baseDefines.push('RENDER_SDF');

            setOcclusionDefines(baseDefines);

            const programConfiguration = bucket.text.programConfigurations.get(layer.id);
            const program = painter.getOrCreateProgram('symbol', {config: programConfiguration, defines: baseDefines});

            let texSizeIcon: [number, number] = [0, 0];
            let atlasTextureIcon: Texture | null = null;
            let atlasInterpolationIcon;

            const sizeData = bucket.textSizeData;

            if (bucket.iconsInText) {
                texSizeIcon = tile.imageAtlasTexture ? tile.imageAtlasTexture.size : [0, 0];
                atlasTextureIcon = tile.imageAtlasTexture ? tile.imageAtlasTexture : null;
                const transformed = textPitchWithMap || tr.pitch !== 0;
                const zoomDependentSize = sizeData.kind === 'composite' || sizeData.kind === 'camera';
                atlasInterpolationIcon = transformed || painter.options.rotating || painter.options.zooming || zoomDependentSize ? gl.LINEAR : gl.NEAREST;
            }

            const texSize: [number, number] = tile.glyphAtlasTexture ? tile.glyphAtlasTexture.size : [0, 0];
            const textSizeScaleRange = layer.layout.get('text-size-scale-range');
            const textScaleFactor = clamp(painter.scaleFactor, textSizeScaleRange[0], textSizeScaleRange[1]);
            const size = symbolSize.evaluateSizeForZoom(sizeData, tr.zoom, textScaleFactor);
            const labelPlaneMatrixRendering = symbolProjection.getLabelPlaneMatrixForRendering(tileMatrix, tile.tileID.canonical, textPitchWithMap, textRotateWithMap, tr, bucket.getProjection(), s);
            // labelPlaneMatrixInv is used for converting vertex pos to tile coordinates needed for sampling elevation.
            const glCoordMatrix = symbolProjection.getGlCoordMatrix(tileMatrix, tile.tileID.canonical, textPitchWithMap, textRotateWithMap, tr, bucket.getProjection(), s);

            const uglCoordMatrix = painter.translatePosMatrix(glCoordMatrix, tile, textTranslate, textTranslateAnchor, true);

            const matrix = painter.translatePosMatrix(tileMatrix, tile, textTranslate, textTranslateAnchor);
            const uLabelPlaneMatrix = projectedPosOnLabelSpace ? identityMat4 : labelPlaneMatrixRendering;

            // Line label rotation happens in `updateLineLabels`
            // Pitched point labels are automatically rotated by the labelPlaneMatrix projection
            // Unpitched point labels need to have their rotation applied after projection
            const rotateInShader = textRotateWithMap && !textPitchWithMap && !alongLine;

            let globeCameraUp = mercatorCameraUp;
            if ((isGlobeProjection || tr.mercatorFromTransition) && !textRotateWithMap) {
                // Each symbol rotating with the viewport requires per-instance information about
                // how to align with the viewport. In 2D case rotation is shared between all of the symbols and
                // hence embedded in the label plane matrix but in globe view this needs to be computed at runtime.
                // Camera up vector together with surface normals can be used to find the correct orientation for each symbol.
                globeCameraUp = computeGlobeCameraUp(tr);
            }

            const cameraUpVector = bucketIsGlobeProjection ? globeCameraUp : mercatorCameraUp;

            const uniformValues = symbolUniformValues(sizeData.kind, size, rotateInShader, textPitchWithMap, painter,
                matrix, uLabelPlaneMatrix, uglCoordMatrix, elevationFromSea, true, texSize, texSizeIcon, true, coord, globeToMercator, mercatorCenter, invMatrix, cameraUpVector, bucket.getProjection(), null, null, textScaleFactor);

            const atlasTexture = tile.glyphAtlasTexture ? tile.glyphAtlasTexture : null;
            const atlasInterpolation = gl.LINEAR;

            const hasHalo = layer.paint.get('text-halo-width').constantOr(1) !== 0;
            const labelPlaneMatrixInv = painter.terrain && textPitchWithMap && alongLine ? mat4.invert(mat4.create(), labelPlaneMatrixRendering) : identityMat4;

            if (alongLine && bucket.text) {
                const elevation = tr.elevation;
                const getElevation = elevation ? elevation.getAtTileOffsetFunc(coord, tr.center.lat, tr.worldSize, bucket.getProjection()) : null;
                const labelPlaneMatrixPlacement = symbolProjection.getLabelPlaneMatrixForPlacement(tileMatrix, tile.tileID.canonical, textPitchWithMap, textRotateWithMap, tr, bucket.getProjection(), s);

                symbolProjection.updateLineLabels(bucket, tileMatrix, painter, true, labelPlaneMatrixPlacement, glCoordMatrix, textPitchWithMap, textKeepUpright, getElevation, coord);
            }

            return {
                program,
                buffers: bucket.text,
                uniformValues,
                atlasTexture,
                atlasTextureIcon,
                atlasInterpolation,
                atlasInterpolationIcon,
                isSDF: true,
                hasHalo,
                tile,
                labelPlaneMatrixInv,
            };
        };

        const iconSegmentsLength = bucket.icon.segments.get().length;
        const textSegmentsLength = bucket.text.segments.get().length;
        const iconState = iconSegmentsLength && !options.onlyText ? getIconState() : null;
        const textState = textSegmentsLength && !options.onlyIcons ? getTextState() : null;

        const iconOpacity = layer.paint.get('icon-opacity').constantOr(1.0);

        const textOpacity = layer.paint.get('text-opacity').constantOr(1.0);

        if (hasSortKey && bucket.canOverlap) {
            sortFeaturesByKey = true;
            const oldIconSegments = iconOpacity && !options.onlyText ? bucket.icon.segments.get() : [];
            const oldTextSegments = textOpacity && !options.onlyIcons ? bucket.text.segments.get() : [];

            for (const segment of oldIconSegments) {
                tileRenderState.push({
                    segments: new SegmentVector([segment]),
                    sortKey: (segment.sortKey),
                    state: iconState
                });
            }

            for (const segment of oldTextSegments) {
                tileRenderState.push({
                    segments: new SegmentVector([segment]),
                    sortKey: (segment.sortKey),
                    state: textState
                });
            }
        } else {
            if (!options.onlyText) {
                tileRenderState.push({
                    segments: iconOpacity ? bucket.icon.segments : new SegmentVector([]),
                    sortKey: 0,
                    state: iconState
                });
            }

            if (!options.onlyIcons) {
                tileRenderState.push({
                    segments: textOpacity ? bucket.text.segments : new SegmentVector([]),
                    sortKey: 0,
                    state: textState
                });
            }
        }
    }

    if (sortFeaturesByKey) {
        tileRenderState.sort((a, b) => a.sortKey - b.sortKey);
    }

    for (const segmentState of tileRenderState) {
        const state = segmentState.state;

        if (!state) {
            continue;
        }

        if (painter.terrain) {
            const options = {
                // Use depth occlusion only for unspecified opacity multiplier case
                useDepthForOcclusion: tr.depthOcclusionForSymbolsAndCircles,
                labelPlaneMatrixInv: state.labelPlaneMatrixInv
            };
            painter.terrain.setupElevationDraw(state.tile, state.program, options);
        } else {
            painter.setupDepthForOcclusion(tr.depthOcclusionForSymbolsAndCircles, state.program);
        }

        context.activeTexture.set(gl.TEXTURE0);
        if (state.atlasTexture) {
            state.atlasTexture.bind(state.atlasInterpolation, gl.CLAMP_TO_EDGE, true);
        }
        if (state.atlasTextureIcon) {
            context.activeTexture.set(gl.TEXTURE1);
            if (state.atlasTextureIcon) {
                state.atlasTextureIcon.bind(state.atlasInterpolationIcon, gl.CLAMP_TO_EDGE, true);
            }
        }

        painter.uploadCommonLightUniforms(painter.context, state.program);

        if (state.hasHalo) {
            const uniformValues = (state.uniformValues as UniformValues<SymbolUniformsType>);
            uniformValues['u_is_halo'] = 1;
            drawSymbolElements(state.buffers, segmentState.segments, layer, painter, state.program, depthMode, stencilMode, colorMode, uniformValues, 2);
            uniformValues['u_is_halo'] = 0;
        } else {
            if (state.isSDF) {
                const uniformValues = (state.uniformValues as UniformValues<SymbolUniformsType>);
                if (state.hasHalo) {
                    uniformValues['u_is_halo'] = 1;
                    drawSymbolElements(state.buffers, segmentState.segments, layer, painter, state.program, depthMode, stencilMode, colorMode, uniformValues, 1);
                }
                uniformValues['u_is_halo'] = 0;
            }
            drawSymbolElements(state.buffers, segmentState.segments, layer, painter, state.program, depthMode, stencilMode, colorMode, state.uniformValues, 1);
        }
    }
}

function drawSymbolElements(buffers: SymbolBuffers, segments: SegmentVector, layer: SymbolStyleLayer, painter: Painter, program: any, depthMode: DepthMode, stencilMode: StencilMode, colorMode: ColorMode, uniformValues: UniformValues<SymbolUniformsType>, instanceCount: number) {
    const context = painter.context;
    const gl = context.gl;
    const dynamicBuffers = [buffers.dynamicLayoutVertexBuffer, buffers.opacityVertexBuffer, buffers.iconTransitioningVertexBuffer, buffers.globeExtVertexBuffer, buffers.zOffsetVertexBuffer];
    program.draw(painter, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
        uniformValues, layer.id, buffers.layoutVertexBuffer,
        buffers.indexBuffer, segments, layer.paint,
        painter.transform.zoom, buffers.programConfigurations.get(layer.id), dynamicBuffers,
        instanceCount);
}
