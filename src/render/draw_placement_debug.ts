import ColorMode from '../gl/color_mode';
import CullFaceMode from '../gl/cull_face_mode';
import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import SegmentVector from '../data/segment';
import Color from '../style-spec/util/color';
import {PlacementDebugLayoutArray, QuadTriangleArray} from '../data/array_types';
import {placementDebugLayout} from '../data/bucket/symbol_attributes';
import {placementDebugUniformValues} from './program/placement_debug_program';
import {VariantPlacementResult} from '../placement/placement_debug';

import type Painter from './painter';
import type {Segment} from '../data/segment';
import type {GeometryElement} from '../placement/geometry';
import type {PremultipliedRenderColor} from '../style-spec/util/color';
import type {VariantPlacementResultValue} from '../placement/placement_debug';

export default drawPlacementDebug;

// Logical pixels.
const OUTLINE_WIDTH = 1;

const INTERIOR_OPACITY = 0.15;
const OUTLINE_OPACITY = 0.5;

const VERTICES_PER_QUAD = 4;
const TRIANGLES_PER_QUAD = 2;

const DRAW_ORDER: ReadonlyArray<{status: VariantPlacementResultValue; color: PremultipliedRenderColor}> = [
    {status: VariantPlacementResult.COLLIDED, color: new Color(1, 0, 0, 1).toPremultipliedRenderColor(null)},
    {status: VariantPlacementResult.OTHER_VARIANT_PLACED, color: new Color(1, 1, 0, 1).toPremultipliedRenderColor(null)},
    {status: VariantPlacementResult.DEPENDENCY_NOT_PLACED, color: new Color(1, 0, 1, 1).toPremultipliedRenderColor(null)},
    {status: VariantPlacementResult.PLACED, color: new Color(0, 0, 1, 1).toPremultipliedRenderColor(null)},
];

function drawPlacementDebug(painter: Painter) {
    const debugSymbols = painter.style.globalPlacement ? painter.style.globalPlacement.debugSymbols() : null;
    if (!debugSymbols || debugSymbols.length === 0) return;

    const context = painter.context;
    const gl = context.gl;
    const tr = painter.transform;

    const vertexArray = new PlacementDebugLayoutArray();
    const indexArray = new QuadTriangleArray();
    const segmentsByStatus = DRAW_ORDER.map(({status}) => {
        const segments = new SegmentVector();
        for (const symbol of debugSymbols) {
            if (symbol.status !== status) continue;
            for (const element of symbol.geometry) {
                addQuad(vertexArray, indexArray, segments, element);
            }
        }
        return segments;
    });

    if (vertexArray.length === 0) return;

    const vertexBuffer = context.createVertexBuffer(vertexArray, placementDebugLayout.members, true);
    const indexBuffer = context.createIndexBuffer(indexArray, true);
    const program = painter.getOrCreateProgram('placementDebug');
    const viewportSize: [number, number] = [tr.width, tr.height];

    for (let i = 0; i < DRAW_ORDER.length; i++) {
        const segments = segmentsByStatus[i];
        if (segments.segments.length === 0) continue;

        program.draw(painter, gl.TRIANGLES,
            DepthMode.disabled, StencilMode.disabled,
            ColorMode.alphaBlended, CullFaceMode.disabled,
            placementDebugUniformValues(viewportSize, DRAW_ORDER[i].color, OUTLINE_WIDTH, INTERIOR_OPACITY, OUTLINE_OPACITY),
            '$placement-debug', vertexBuffer, indexBuffer, segments, null, tr.zoom);
    }

    vertexBuffer.destroy();
    indexBuffer.destroy();
}

function addQuad(vertexArray: PlacementDebugLayoutArray, indexArray: QuadTriangleArray, segments: SegmentVector, element: GeometryElement) {
    let centerX: number, centerY: number, halfWidth: number, halfHeight: number, isCircle: number;
    if (element.kind === 'box') {
        centerX = 0.5 * (element.left + element.right);
        centerY = 0.5 * (element.top + element.bottom);
        halfWidth = 0.5 * (element.right - element.left);
        halfHeight = 0.5 * (element.bottom - element.top);
        isCircle = 0;
    } else {
        centerX = element.x;
        centerY = element.y;
        halfWidth = element.radius;
        halfHeight = element.radius;
        isCircle = 1;
    }

    const segment: Segment = segments.prepareSegment(VERTICES_PER_QUAD, vertexArray, indexArray);
    const firstVertex = segment.vertexLength;

    for (let corner = 0; corner < VERTICES_PER_QUAD; corner++) {
        vertexArray.emplaceBack(centerX, centerY, halfWidth, halfHeight, isCircle, corner);
    }
    indexArray.emplaceBack(firstVertex, firstVertex + 1, firstVertex + 2);
    indexArray.emplaceBack(firstVertex, firstVertex + 2, firstVertex + 3);

    segment.vertexLength += VERTICES_PER_QUAD;
    segment.primitiveLength += TRIANGLES_PER_QUAD;
}
