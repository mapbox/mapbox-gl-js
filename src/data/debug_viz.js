// @flow
import {PosArray, LineStripIndexArray} from "./array_types";
import SegmentVector from "./segment";
import posAttributes from './pos_attributes';
import Color from "../style-spec/util/color";

import type VertexBuffer from "../gl/vertex_buffer";
import type IndexBuffer from "../gl/index_buffer";
import type Point from '@mapbox/point-geometry';
import type Context from "../gl/context";

/**
 * Helper class that can be used to draw debug geometry in tile-space
 *
 * @class TileSpaceDebugBuffer
 * @private
 */
export class TileSpaceDebugBuffer {
    vertices: PosArray;
    indices: LineStripIndexArray;
    tileSize: number;
    needsUpload: boolean;
    color: Color;

    vertexBuffer: ?VertexBuffer;
    indexBuffer: ?IndexBuffer;
    segments: ?SegmentVector;

    constructor(tileSize: number, color: Color = Color.red) {
        this.vertices = new PosArray();
        this.indices = new LineStripIndexArray();
        this.tileSize = tileSize;
        this.needsUpload = true;
        this.color = color;
    }

    addPoints(points: Point[]) {
        this.clearPoints();
        for (const point of points) {
            this.addPoint(point);
        }
        this.addPoint(points[0]);
    }

    addPoint(p: Point) {
        // Add a bowtie shape
        const crosshairSize = 80;
        const currLineLineLength = this.vertices.length;
        this.vertices.emplaceBack(p.x, p.y);
        this.vertices.emplaceBack(p.x + crosshairSize / 2, p.y);
        this.vertices.emplaceBack(p.x, p.y - crosshairSize / 2);
        this.vertices.emplaceBack(p.x, p.y + crosshairSize / 2);
        this.vertices.emplaceBack(p.x - crosshairSize / 2, p.y);
        this.indices.emplaceBack(currLineLineLength);
        this.indices.emplaceBack(currLineLineLength + 1);
        this.indices.emplaceBack(currLineLineLength + 2);
        this.indices.emplaceBack(currLineLineLength + 3);
        this.indices.emplaceBack(currLineLineLength + 4);
        this.indices.emplaceBack(currLineLineLength);

        this.needsUpload = true;
    }

    clearPoints() {
        this.vertices.clear();
        this.indices.clear();
        this.needsUpload = true;
    }

    lazyUpload(context: Context) {
        if (this.needsUpload && this.hasVertices()) {
            this.unload();

            this.vertexBuffer = context.createVertexBuffer(this.vertices, posAttributes.members, true);
            this.indexBuffer = context.createIndexBuffer(this.indices, true);
            this.segments = SegmentVector.simpleSegment(0, 0, this.vertices.length, this.indices.length);
            this.needsUpload = false;
        }
    }

    hasVertices(): boolean {
        return this.vertices.length > 1;
    }

    unload() {
        if (this.vertexBuffer) {
            this.vertexBuffer.destroy();
            delete this.vertexBuffer;
        }
        if (this.indexBuffer) {
            this.indexBuffer.destroy();
            delete this.indexBuffer;
        }
        if (this.segments) {
            this.segments.destroy();
            delete this.segments;
        }
    }
}
