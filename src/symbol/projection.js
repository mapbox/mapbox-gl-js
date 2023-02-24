// @flow

import Point from '@mapbox/point-geometry';

import {mat2, mat4, vec3, vec4} from 'gl-matrix';
import * as symbolSize from './symbol_size.js';
import {addDynamicAttributes, updateGlobeVertexNormal} from '../data/bucket/symbol_bucket.js';
import type Projection from '../geo/projection/projection.js';
import type Painter from '../render/painter.js';
import type Transform from '../geo/transform.js';
import type SymbolBucket from '../data/bucket/symbol_bucket.js';
import type {
    GlyphOffsetArray,
    SymbolLineVertexArray,
    SymbolDynamicLayoutArray,
    SymbolGlobeExtArray,
    PlacedSymbol
} from '../data/array_types.js';
import type {Mat4, Vec3, Vec4} from 'gl-matrix';

import {WritingMode} from '../symbol/shaping.js';
import {CanonicalTileID, OverscaledTileID} from '../source/tile_id.js';
import {calculateGlobeLabelMatrix} from '../geo/projection/globe_util.js';
export {updateLineLabels, hideGlyphs, getLabelPlaneMatrixForRendering, getLabelPlaneMatrixForPlacement, getGlCoordMatrix, project, projectClamped, getPerspectiveRatio, placeFirstAndLastGlyph, placeGlyphAlongLine, xyTransformMat4};

type PlacedGlyph = {|
    angle: number,
    path: Array<Vec3>,
    point: Vec3,
    tilePath: Array<Point>,
    up: Vec3
|};
type ProjectionCache = {[_: number]: Vec3};

type PlacementStatus = {
    needsFlipping?: boolean,
    notEnoughRoom?: boolean,
    useVertical?: boolean
};

const FlipState = {
    unknown: 0,
    flipRequired: 1,
    flipNotRequired: 2
};

const maxTangent = Math.tan(85 * Math.PI / 180);

/*
 * # Overview of coordinate spaces
 *
 * ## Tile coordinate spaces
 * Each label has an anchor. Some labels have corresponding line geometries.
 * The points for both anchors and lines are stored in tile units. Each tile has it's own
 * coordinate space going from (0, 0) at the top left to (EXTENT, EXTENT) at the bottom right.
 *
 * ## GL coordinate space
 * At the end of everything, the vertex shader needs to produce a position in GL coordinate space,
 * which is (-1, 1) at the top left and (1, -1) in the bottom right.
 *
 * ## Map pixel coordinate spaces
 * Each tile has a pixel coordinate space. It's just the tile units scaled so that one unit is
 * whatever counts as 1 pixel at the current zoom.
 * This space is used for pitch-alignment=map, rotation-alignment=map
 *
 * ## Rotated map pixel coordinate spaces
 * Like the above, but rotated so axis of the space are aligned with the viewport instead of the tile.
 * This space is used for pitch-alignment=map, rotation-alignment=viewport
 *
 * ## Viewport pixel coordinate space
 * (0, 0) is at the top left of the canvas and (pixelWidth, pixelHeight) is at the bottom right corner
 * of the canvas. This space is used for pitch-alignment=viewport
 *
 *
 * # Vertex projection
 * It goes roughly like this:
 * 1. project the anchor and line from tile units into the correct label coordinate space
 *      - map pixel space           pitch-alignment=map         rotation-alignment=map
 *      - rotated map pixel space   pitch-alignment=map         rotation-alignment=viewport
 *      - viewport pixel space      pitch-alignment=viewport    rotation-alignment=*
 * 2. if the label follows a line, find the point along the line that is the correct distance from the anchor.
 * 3. add the glyph's corner offset to the point from step 3
 * 4. convert from the label coordinate space to gl coordinates
 *
 * For horizontal labels we want to do step 1 in the shader for performance reasons (no cpu work).
 *      This is what `u_label_plane_matrix` is used for.
 * For labels aligned with lines we have to steps 1 and 2 on the cpu since we need access to the line geometry.
 *      This is what `updateLineLabels(...)` does.
 *      Since the conversion is handled on the cpu we just set `u_label_plane_matrix` to an identity matrix.
 *
 * Steps 3 and 4 are done in the shaders for all labels.
 */

/*
 * Returns a matrix for converting from tile units to the correct label coordinate space.
 * This variation of the function returns a label space matrix specialized for rendering.
 * It transforms coordinates as-is to whatever the target space is (either 2D or 3D).
 * See also `getLabelPlaneMatrixForPlacement`
 */
function getLabelPlaneMatrixForRendering(posMatrix: Float32Array,
                             tileID: CanonicalTileID,
                             pitchWithMap: boolean,
                             rotateWithMap: boolean,
                             transform: Transform,
                             projection: Projection,
                             pixelsToTileUnits: Float32Array): Float32Array {
    const m = mat4.create();

    if (pitchWithMap) {
        if (projection.name === 'globe') {
            const lm = calculateGlobeLabelMatrix(transform, tileID);
            mat4.multiply(m, m, lm);
        } else {
            const s = mat2.invert([], pixelsToTileUnits);
            m[0] = s[0];
            m[1] = s[1];
            m[4] = s[2];
            m[5] = s[3];
            if (!rotateWithMap) {
                mat4.rotateZ(m, m, transform.angle);
            }
        }
    } else {
        mat4.multiply(m, transform.labelPlaneMatrix, posMatrix);
    }

    return m;
}

/*
 * Returns a matrix for converting from tile units to the correct label coordinate space.
 * This variation of the function returns a matrix specialized for placement logic.
 * Coordinates will be clamped to x&y 2D plane which is used with viewport and map aligned placement
 * logic in most cases. Certain projections such as globe view will use 3D space for map aligned
 * label placement.
 */
function getLabelPlaneMatrixForPlacement(posMatrix: Float32Array,
                             tileID: CanonicalTileID,
                             pitchWithMap: boolean,
                             rotateWithMap: boolean,
                             transform: Transform,
                             projection: Projection,
                             pixelsToTileUnits: Float32Array): Float32Array {
    const m = getLabelPlaneMatrixForRendering(posMatrix, tileID, pitchWithMap, rotateWithMap, transform, projection, pixelsToTileUnits);

    // Symbol placement logic is performed in 2D in most scenarios.
    // For this reason project all coordinates to the xy-plane by discarding the z-component
    if (projection.name !== 'globe' || !pitchWithMap) {
        // Pre-multiply by scaling z to 0
        m[2] = m[6] = m[10] = m[14] = 0;
    }

    return m;
}

/*
 * Returns a matrix for converting from the correct label coordinate space to gl coords.
 */
function getGlCoordMatrix(posMatrix: Float32Array,
                          tileID: CanonicalTileID,
                          pitchWithMap: boolean,
                          rotateWithMap: boolean,
                          transform: Transform,
                          projection: Projection,
                          pixelsToTileUnits: Float32Array): Float32Array {
    if (pitchWithMap) {
        if (projection.name === 'globe') {
            const m = getLabelPlaneMatrixForRendering(posMatrix, tileID, pitchWithMap, rotateWithMap, transform, projection, pixelsToTileUnits);
            mat4.invert(m, m);
            mat4.multiply(m, posMatrix, m);
            return m;
        } else {
            const m = mat4.clone(posMatrix);
            const s = mat4.identity([]);
            s[0] = pixelsToTileUnits[0];
            s[1] = pixelsToTileUnits[1];
            s[4] = pixelsToTileUnits[2];
            s[5] = pixelsToTileUnits[3];
            mat4.multiply(m, m, s);
            if (!rotateWithMap) {
                mat4.rotateZ(m, m, -transform.angle);
            }
            return m;
        }
    } else {
        return transform.glCoordMatrix;
    }
}

function project(x: number, y: number, z: number, matrix: Mat4): Vec4 {
    const pos = [x, y, z, 1];
    if (z) {
        vec4.transformMat4(pos, pos, matrix);
    } else {
        xyTransformMat4(pos, pos, matrix);
    }
    const w = pos[3];
    pos[0] /= w;
    pos[1] /= w;
    pos[2] /= w;
    return pos;
}

function projectClamped([x, y, z]: Vec3, matrix: Mat4): Vec4 {
    const pos = [x, y, z, 1];
    vec4.transformMat4(pos, pos, matrix);

    // Clamp distance to a positive value so we can avoid screen coordinate
    // being flipped possibly due to perspective projection
    const w = pos[3] = Math.max(pos[3], 0.000001);
    pos[0] /= w;
    pos[1] /= w;
    pos[2] /= w;
    return pos;
}

function getPerspectiveRatio(cameraToCenterDistance: number, signedDistanceFromCamera: number): number {
    return Math.min(0.5 + 0.5 * (cameraToCenterDistance / signedDistanceFromCamera), 1.5);
}

function isVisible(anchorPos: [number, number, number, number],
                   clippingBuffer: [number, number]) {
    const x = anchorPos[0] / anchorPos[3];
    const y = anchorPos[1] / anchorPos[3];
    const inPaddedViewport = (
        x >= -clippingBuffer[0] &&
        x <= clippingBuffer[0] &&
        y >= -clippingBuffer[1] &&
        y <= clippingBuffer[1]);
    return inPaddedViewport;
}

/*
 *  Update the `dynamicLayoutVertexBuffer` for the buffer with the correct glyph positions for the current map view.
 *  This is only run on labels that are aligned with lines. Horizontal labels are handled entirely in the shader.
 */
function updateLineLabels(bucket: SymbolBucket,
                          posMatrix: Float32Array,
                          painter: Painter,
                          isText: boolean,
                          labelPlaneMatrix: Float32Array,
                          glCoordMatrix: Float32Array,
                          pitchWithMap: boolean,
                          keepUpright: boolean,
                          getElevation: ?((p: Point) => Array<number>),
                          tileID: OverscaledTileID) {

    const tr = painter.transform;
    const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;
    const partiallyEvaluatedSize = symbolSize.evaluateSizeForZoom(sizeData, painter.transform.zoom);
    const isGlobe = tr.projection.name === 'globe';

    const clippingBuffer = [256 / painter.width * 2 + 1, 256 / painter.height * 2 + 1];

    const dynamicLayoutVertexArray = isText ?
        bucket.text.dynamicLayoutVertexArray :
        bucket.icon.dynamicLayoutVertexArray;
    dynamicLayoutVertexArray.clear();

    let globeExtVertexArray: ?SymbolGlobeExtArray = null;
    if (isGlobe) {
        globeExtVertexArray = isText ?
            bucket.text.globeExtVertexArray :
            bucket.icon.globeExtVertexArray;
    }

    const lineVertexArray = bucket.lineVertexArray;
    const placedSymbols = isText ? bucket.text.placedSymbolArray : bucket.icon.placedSymbolArray;

    const aspectRatio = painter.transform.width / painter.transform.height;

    let useVertical: ?boolean = false;
    let prevWritingMode;

    for (let s = 0; s < placedSymbols.length; s++) {
        const symbol = placedSymbols.get(s);
        const {numGlyphs, writingMode} = symbol;

        // Normally, the 'Horizontal|Vertical' writing mode is followed by a 'Vertical' counterpart, this
        // is not true for 'Vertical' only line labels. For this case, we'll have to overwrite the 'useVertical'
        // status before further checks.
        if (writingMode === WritingMode.vertical && !useVertical && prevWritingMode !== WritingMode.horizontal) {
            useVertical = true;
        }
        prevWritingMode = writingMode;

        // Don't do calculations for vertical glyphs unless the previous symbol was horizontal
        // and we determined that vertical glyphs were necessary.
        // Also don't do calculations for symbols that are collided and fully faded out
        if ((symbol.hidden || writingMode === WritingMode.vertical) && !useVertical) {
            hideGlyphs(numGlyphs, dynamicLayoutVertexArray);
            continue;
        }
        // Awkward... but we're counting on the paired "vertical" symbol coming immediately after its horizontal counterpart
        useVertical = false;

        // Project tile anchor to globe anchor
        const tileAnchorPoint = new Point(symbol.tileAnchorX, symbol.tileAnchorY);
        let {x, y, z} = tr.projection.projectTilePoint(tileAnchorPoint.x, tileAnchorPoint.y, tileID.canonical);
        if (getElevation) {
            const [dx, dy, dz] = getElevation(tileAnchorPoint);
            x += dx;
            y += dy;
            z += dz;
        }
        const anchorPos = [x, y, z, 1.0];
        vec4.transformMat4(anchorPos, anchorPos, posMatrix);

        // Don't bother calculating the correct point for invisible labels.
        if (!isVisible(anchorPos, clippingBuffer)) {
            hideGlyphs(numGlyphs, dynamicLayoutVertexArray);
            continue;
        }
        const cameraToAnchorDistance = anchorPos[3];
        const perspectiveRatio = getPerspectiveRatio(painter.transform.cameraToCenterDistance, cameraToAnchorDistance);

        const fontSize = symbolSize.evaluateSizeForFeature(sizeData, partiallyEvaluatedSize, symbol);
        const pitchScaledFontSize = pitchWithMap ? fontSize / perspectiveRatio : fontSize * perspectiveRatio;

        const labelPlaneAnchorPoint = project(x, y, z, labelPlaneMatrix);

        // Skip labels behind the camera
        if (labelPlaneAnchorPoint[3] <= 0.0) {
            hideGlyphs(numGlyphs, dynamicLayoutVertexArray);
            continue;
        }

        let projectionCache: ProjectionCache = {};

        const getElevationForPlacement = pitchWithMap ? null : getElevation; // When pitchWithMap, we're projecting to scaled tile coordinate space: there is no need to get elevation as it doesn't affect projection.
        const placeUnflipped = placeGlyphsAlongLine(symbol, pitchScaledFontSize, false /*unflipped*/, keepUpright, posMatrix, labelPlaneMatrix, glCoordMatrix,
            bucket.glyphOffsetArray, lineVertexArray, dynamicLayoutVertexArray, globeExtVertexArray, labelPlaneAnchorPoint, tileAnchorPoint, projectionCache, aspectRatio, getElevationForPlacement, tr.projection, tileID, pitchWithMap);

        useVertical = placeUnflipped.useVertical;

        if (getElevationForPlacement && placeUnflipped.needsFlipping) projectionCache = {}; // Truncated points should be recalculated.
        if (placeUnflipped.notEnoughRoom || useVertical ||
            (placeUnflipped.needsFlipping &&
             placeGlyphsAlongLine(symbol, pitchScaledFontSize, true /*flipped*/, keepUpright, posMatrix, labelPlaneMatrix, glCoordMatrix,
                 bucket.glyphOffsetArray, lineVertexArray, dynamicLayoutVertexArray, globeExtVertexArray, labelPlaneAnchorPoint, tileAnchorPoint, projectionCache, aspectRatio, getElevationForPlacement, tr.projection, tileID, pitchWithMap).notEnoughRoom)) {
            hideGlyphs(numGlyphs, dynamicLayoutVertexArray);
        }
    }

    if (isText) {
        bucket.text.dynamicLayoutVertexBuffer.updateData(dynamicLayoutVertexArray);
        if (globeExtVertexArray) {
            bucket.text.globeExtVertexBuffer.updateData(globeExtVertexArray);
        }
    } else {
        bucket.icon.dynamicLayoutVertexBuffer.updateData(dynamicLayoutVertexArray);
        if (globeExtVertexArray) {
            bucket.icon.globeExtVertexBuffer.updateData(globeExtVertexArray);
        }
    }
}

function placeFirstAndLastGlyph(
    fontScale: number,
    glyphOffsetArray: GlyphOffsetArray,
    lineOffsetX: number,
    lineOffsetY: number,
    flip: boolean,
    anchorPoint: Vec3,
    tileAnchorPoint: Point,
    symbol: PlacedSymbol,
    lineVertexArray: SymbolLineVertexArray,
    labelPlaneMatrix: Float32Array,
    projectionCache: ProjectionCache,
    getElevation: ?((p: Point) => Array<number>),
    returnPathInTileCoords: ?boolean,
    projection: Projection,
    tileID: OverscaledTileID,
    pitchWithMap: boolean): null | {|first: PlacedGlyph, last: PlacedGlyph|} {

    const {lineStartIndex, glyphStartIndex, segment} = symbol;
    const glyphEndIndex = glyphStartIndex + symbol.numGlyphs;
    const lineEndIndex = lineStartIndex + symbol.lineLength;

    const firstGlyphOffset = glyphOffsetArray.getoffsetX(glyphStartIndex);
    const lastGlyphOffset = glyphOffsetArray.getoffsetX(glyphEndIndex - 1);

    const firstPlacedGlyph = placeGlyphAlongLine(fontScale * firstGlyphOffset, lineOffsetX, lineOffsetY, flip, anchorPoint, tileAnchorPoint, segment,
        lineStartIndex, lineEndIndex, lineVertexArray, labelPlaneMatrix, projectionCache, getElevation, returnPathInTileCoords, true, projection, tileID, pitchWithMap);
    if (!firstPlacedGlyph)
        return null;

    const lastPlacedGlyph = placeGlyphAlongLine(fontScale * lastGlyphOffset, lineOffsetX, lineOffsetY, flip, anchorPoint, tileAnchorPoint, segment,
        lineStartIndex, lineEndIndex, lineVertexArray, labelPlaneMatrix, projectionCache, getElevation, returnPathInTileCoords, true, projection, tileID, pitchWithMap);
    if (!lastPlacedGlyph)
        return null;

    return {first: firstPlacedGlyph, last: lastPlacedGlyph};
}

// Check in the glCoordinate space, the rough estimation of angle between the text line and the Y axis.
// If the angle if less or equal to 5 degree, then keep the text glyphs unflipped even if it is required.
function isInFlipRetainRange(dx, dy) {
    return dx === 0 || Math.abs(dy / dx) > maxTangent;
}

function requiresOrientationChange(writingMode, flipState, dx, dy) {
    if (writingMode === WritingMode.horizontal && Math.abs(dy) > Math.abs(dx)) {
        // On top of choosing whether to flip, choose whether to render this version of the glyphs or the alternate
        // vertical glyphs. We can't just filter out vertical glyphs in the horizontal range because the horizontal
        // and vertical versions can have slightly different projections which could lead to angles where both or
        // neither showed.
        return {useVertical: true};
    }
    // Check if flipping is required for "verticalOnly" case.
    if (writingMode === WritingMode.vertical) {
        return dy > 0 ? {needsFlipping: true} : null;
    }

    // symbol's flipState stores the flip decision from the previous frame, and that
    // decision is reused when the symbol is in the retain range.
    if (flipState !== FlipState.unknown && isInFlipRetainRange(dx, dy)) {
        return (flipState === FlipState.flipRequired) ? {needsFlipping: true} : null;
    }

    // Check if flipping is required for "horizontal" case.
    return dx < 0 ? {needsFlipping: true} : null;
}

function placeGlyphsAlongLine(symbol, fontSize, flip, keepUpright, posMatrix, labelPlaneMatrix, glCoordMatrix, glyphOffsetArray, lineVertexArray, dynamicLayoutVertexArray, globeExtVertexArray, anchorPoint, tileAnchorPoint, projectionCache, aspectRatio, getElevation, projection, tileID, pitchWithMap): PlacementStatus {
    const fontScale = fontSize / 24;
    const lineOffsetX = symbol.lineOffsetX * fontScale;
    const lineOffsetY = symbol.lineOffsetY * fontScale;
    const {lineStartIndex, glyphStartIndex, numGlyphs, segment, writingMode, flipState} = symbol;
    const lineEndIndex = lineStartIndex + symbol.lineLength;

    const addGlyph = (glyph: PlacedGlyph) => {
        if (globeExtVertexArray) {
            const [ux, uy, uz] = glyph.up;
            const offset = dynamicLayoutVertexArray.length;
            updateGlobeVertexNormal(globeExtVertexArray, offset + 0, ux, uy, uz);
            updateGlobeVertexNormal(globeExtVertexArray, offset + 1, ux, uy, uz);
            updateGlobeVertexNormal(globeExtVertexArray, offset + 2, ux, uy, uz);
            updateGlobeVertexNormal(globeExtVertexArray, offset + 3, ux, uy, uz);
        }
        const [x, y, z] = glyph.point;
        addDynamicAttributes(dynamicLayoutVertexArray, x, y, z, glyph.angle);
    };

    if (numGlyphs > 1) {
        // Place the first and the last glyph in the label first, so we can figure out
        // the overall orientation of the label and determine whether it needs to be flipped in keepUpright mode
        const firstAndLastGlyph = placeFirstAndLastGlyph(fontScale, glyphOffsetArray, lineOffsetX, lineOffsetY, flip, anchorPoint, tileAnchorPoint, symbol, lineVertexArray, labelPlaneMatrix, projectionCache, getElevation, false, projection, tileID, pitchWithMap);
        if (!firstAndLastGlyph) {
            return {notEnoughRoom: true};
        }

        if (keepUpright && !flip) {
            let [x0, y0, z0] = firstAndLastGlyph.first.point;
            let [x1, y1, z1] = firstAndLastGlyph.last.point;
            [x0, y0] = project(x0, y0, z0, glCoordMatrix);
            [x1, y1] = project(x1, y1, z1, glCoordMatrix);
            const orientationChange = requiresOrientationChange(writingMode, flipState, (x1 - x0) * aspectRatio, y1 - y0);
            symbol.flipState = orientationChange && orientationChange.needsFlipping ? FlipState.flipRequired : FlipState.flipNotRequired;
            if (orientationChange) {
                return orientationChange;
            }
        }

        addGlyph(firstAndLastGlyph.first);
        for (let glyphIndex = glyphStartIndex + 1; glyphIndex < glyphStartIndex + numGlyphs - 1; glyphIndex++) {
            // Since first and last glyph fit on the line, the rest of the glyphs can be placed too, but check to make sure
            const glyph = placeGlyphAlongLine(fontScale * glyphOffsetArray.getoffsetX(glyphIndex), lineOffsetX, lineOffsetY, flip, anchorPoint, tileAnchorPoint, segment,
                lineStartIndex, lineEndIndex, lineVertexArray, labelPlaneMatrix, projectionCache, getElevation, false, false, projection, tileID, pitchWithMap);
            if (!glyph) {
                // undo previous glyphs of the symbol if it doesn't fit; it will be filled with hideGlyphs instead
                dynamicLayoutVertexArray.length -= 4 * (glyphIndex - glyphStartIndex);
                return {notEnoughRoom: true};
            }
            addGlyph(glyph);
        }
        addGlyph(firstAndLastGlyph.last);
    } else {
        // Only a single glyph to place
        // So, determine whether to flip based on projected angle of the line segment it's on
        if (keepUpright && !flip) {
            const a = project(tileAnchorPoint.x, tileAnchorPoint.y, 0, posMatrix);
            const tileVertexIndex = lineStartIndex + segment + 1;
            const tileSegmentEnd = new Point(lineVertexArray.getx(tileVertexIndex), lineVertexArray.gety(tileVertexIndex));
            const projectedVertex = project(tileSegmentEnd.x, tileSegmentEnd.y, 0, posMatrix);
            // We know the anchor will be in the viewport, but the end of the line segment may be
            // behind the plane of the camera, in which case we can use a point at any arbitrary (closer)
            // point on the segment.
            const b = (projectedVertex[3] > 0) ?
                projectedVertex :
                projectTruncatedLineSegment(tileAnchorPoint, tileSegmentEnd, a, 1, posMatrix, undefined, projection, tileID.canonical);

            const orientationChange = requiresOrientationChange(writingMode, flipState, (b[0] - a[0]) * aspectRatio, b[1] - a[1]);
            symbol.flipState = orientationChange && orientationChange.needsFlipping ? FlipState.flipRequired : FlipState.flipNotRequired;
            if (orientationChange) {
                return orientationChange;
            }
        }
        const singleGlyph = placeGlyphAlongLine(fontScale * glyphOffsetArray.getoffsetX(glyphStartIndex), lineOffsetX, lineOffsetY, flip, anchorPoint, tileAnchorPoint, segment,
            lineStartIndex, lineEndIndex, lineVertexArray, labelPlaneMatrix, projectionCache, getElevation, false, false, projection, tileID, pitchWithMap);
        if (!singleGlyph) {
            return {notEnoughRoom: true};
        }

        addGlyph(singleGlyph);
    }
    return {};
}

function elevatePointAndProject(p: Point, tileID: CanonicalTileID, posMatrix: Float32Array, projection: Projection, getElevation: ?((p: Point) => Array<number>)) {
    const {x, y, z} = projection.projectTilePoint(p.x, p.y, tileID);
    if (!getElevation) {
        return project(x, y, z, posMatrix);
    }
    const [dx, dy, dz] = getElevation(p);
    return project(x + dx, y + dy, z + dz, posMatrix);
}

function projectTruncatedLineSegment(previousTilePoint: Point, currentTilePoint: Point, previousProjectedPoint: Vec3, minimumLength: number, projectionMatrix: Float32Array, getElevation: ?((p: Point) => Array<number>), projection: Projection, tileID: CanonicalTileID): Vec3 {
    // We are assuming "previousTilePoint" won't project to a point within one unit of the camera plane
    // If it did, that would mean our label extended all the way out from within the viewport to a (very distant)
    // point near the plane of the camera. We wouldn't be able to render the label anyway once it crossed the
    // plane of the camera.
    const unitVertex = previousTilePoint.sub(currentTilePoint)._unit()._add(previousTilePoint);
    const projectedUnit = elevatePointAndProject(unitVertex, tileID, projectionMatrix, projection, getElevation);
    vec3.sub(projectedUnit, previousProjectedPoint, projectedUnit);
    vec3.normalize(projectedUnit, projectedUnit);

    return vec3.scaleAndAdd(projectedUnit, previousProjectedPoint, projectedUnit, minimumLength);
}

function placeGlyphAlongLine(
    offsetX: number,
    lineOffsetX: number,
    lineOffsetY: number,
    flip: boolean,
    anchorPoint: Vec3,
    tileAnchorPoint: Point,
    anchorSegment: number,
    lineStartIndex: number,
    lineEndIndex: number,
    lineVertexArray: SymbolLineVertexArray,
    labelPlaneMatrix: Float32Array,
    projectionCache: ProjectionCache,
    getElevation: ?((p: Point) => Array<number>),
    returnPathInTileCoords: ?boolean,
    endGlyph: ?boolean,
    reprojection: Projection,
    tileID: OverscaledTileID,
    pitchWithMap: boolean): null | PlacedGlyph {

    const combinedOffsetX = flip ?
        offsetX - lineOffsetX :
        offsetX + lineOffsetX;

    let dir = combinedOffsetX > 0 ? 1 : -1;

    let angle = 0;
    if (flip) {
        // The label needs to be flipped to keep text upright.
        // Iterate in the reverse direction.
        dir *= -1;
        angle = Math.PI;
    }

    if (dir < 0) angle += Math.PI;

    let currentIndex = lineStartIndex + anchorSegment + (dir > 0 ? 0 : 1) | 0;
    let current = anchorPoint;
    let prev = anchorPoint;
    let distanceToPrev = 0;
    let currentSegmentDistance = 0;
    const absOffsetX = Math.abs(combinedOffsetX);
    const pathVertices = [];
    const tilePath = [];
    let currentVertex = tileAnchorPoint;
    let prevVertex = currentVertex;

    const getTruncatedLineSegment = () => {
        return projectTruncatedLineSegment(prevVertex, currentVertex, prev, absOffsetX - distanceToPrev + 1, labelPlaneMatrix, getElevation, reprojection, tileID.canonical);
    };

    while (distanceToPrev + currentSegmentDistance <= absOffsetX) {
        currentIndex += dir;

        // offset does not fit on the projected line
        if (currentIndex < lineStartIndex || currentIndex >= lineEndIndex)
            return null;

        prev = current;
        prevVertex = currentVertex;

        pathVertices.push(prev);
        if (returnPathInTileCoords) tilePath.push(prevVertex);

        currentVertex = new Point(lineVertexArray.getx(currentIndex), lineVertexArray.gety(currentIndex));
        current = projectionCache[currentIndex];
        if (!current) {
            const projection = elevatePointAndProject(currentVertex, tileID.canonical, labelPlaneMatrix, reprojection, getElevation);
            if (projection[3] > 0) {
                current = projectionCache[currentIndex] = projection;
            } else {
                // The vertex is behind the plane of the camera, so we can't project it
                // Instead, we'll create a vertex along the line that's far enough to include the glyph
                // Don't cache because the new vertex might not be far enough out for future glyphs on the same segment
                current = getTruncatedLineSegment();
            }
        }

        distanceToPrev += currentSegmentDistance;
        currentSegmentDistance = vec3.distance(prev, current);
    }

    if (endGlyph && getElevation) {
        // For terrain, always truncate end points in order to handle terrain curvature.
        // If previously truncated, on signedDistanceFromCamera < 0, don't do it.
        // Cache as end point. The cache is cleared if there is need for flipping in updateLineLabels.
        if (projectionCache[currentIndex]) {
            current = getTruncatedLineSegment();
            currentSegmentDistance = vec3.distance(prev, current);
        }
        projectionCache[currentIndex] = current;
    }

    // The point is on the current segment. Interpolate to find it. Compute points on both label plane and tile space
    const segmentInterpolationT = (absOffsetX - distanceToPrev) / currentSegmentDistance;
    const tilePoint = currentVertex.sub(prevVertex)._mult(segmentInterpolationT)._add(prevVertex);
    const prevToCurrent = vec3.sub([], current, prev);
    const labelPlanePoint = vec3.scaleAndAdd([], prev, prevToCurrent, segmentInterpolationT);

    let axisZ: Vec3 = [0, 0, 1];
    let diffX = prevToCurrent[0];
    let diffY = prevToCurrent[1];

    if (pitchWithMap) {
        axisZ = reprojection.upVector(tileID.canonical, tilePoint.x, tilePoint.y);

        if (axisZ[0] !== 0 || axisZ[1] !== 0 || axisZ[2] !== 1) {
            // Compute coordinate frame that is aligned to the tangent of the surface
            const axisX = [axisZ[2], 0, -axisZ[0]];
            const axisY = vec3.cross([], axisZ, axisX);
            vec3.normalize(axisX, axisX);
            vec3.normalize(axisY, axisY);
            diffX = vec3.dot(prevToCurrent, axisX);
            diffY = vec3.dot(prevToCurrent, axisY);
        }
    }

    // offset the point from the line to text-offset and icon-offset
    if (lineOffsetY) {
        // Find a coordinate frame for the vertical offset
        const offsetDir = vec3.cross([], axisZ, prevToCurrent);
        vec3.normalize(offsetDir, offsetDir);
        vec3.scaleAndAdd(labelPlanePoint, labelPlanePoint, offsetDir, lineOffsetY * dir);
    }

    const segmentAngle = angle + Math.atan2(diffY, diffX);

    pathVertices.push(labelPlanePoint);
    if (returnPathInTileCoords) {
        tilePath.push(tilePoint);
    }

    return {
        point: labelPlanePoint,
        angle: segmentAngle,
        path: pathVertices,
        tilePath,
        up: axisZ
    };
}

// Hide them by moving them offscreen. We still need to add them to the buffer
// because the dynamic buffer is paired with a static buffer that doesn't get updated.
function hideGlyphs(num: number, dynamicLayoutVertexArray: SymbolDynamicLayoutArray) {
    const offset = dynamicLayoutVertexArray.length;
    const end = offset + 4 * num;
    dynamicLayoutVertexArray.resize(end);
    // Since all hidden glyphs have the same attributes, we can build up the array faster with a single call to
    // Float32Array.fill for all vertices, instead of calling addDynamicAttributes for each vertex.
    dynamicLayoutVertexArray.float32.fill(-Infinity, offset * 4, end * 4);
}

// For line label layout, we're not using z output and our w input is always 1
// This custom matrix transformation ignores those components to make projection faster
function xyTransformMat4(out: Vec4, a: Vec4, m: Mat4): Vec4 {
    const x = a[0], y = a[1];
    out[0] = m[0] * x + m[4] * y + m[12];
    out[1] = m[1] * x + m[5] * y + m[13];
    out[3] = m[3] * x + m[7] * y + m[15];
    return out;
}
