// @flow

import type {CollisionBoxArray} from '../data/array_types';
import Point from '@mapbox/point-geometry';
import type Anchor from './anchor';

/**
 * A CollisionFeature represents the area of the tile covered by a single label.
 * It is used with CollisionIndex to check if the label overlaps with any
 * previous labels. A CollisionFeature is mostly just a set of CollisionBox
 * objects.
 *
 * @private
 */
class CollisionFeature {
    boxStartIndex: number;
    boxEndIndex: number;
    circleDiameter: ?number;

    /**
     * Create a CollisionFeature, adding its collision box data to the given collisionBoxArray in the process.
     * For line aligned labels a collision circle diameter is computed instead.
     *
     * @param anchor The point along the line around which the label is anchored.
     * @param shaped The text or icon shaping results.
     * @param boxScale A magic number used to convert from glyph metrics units to geometry units.
     * @param padding The amount of padding to add around the label edges.
     * @param alignLine Whether the label is aligned with the line or the viewport.
     * @private
     */
    constructor(collisionBoxArray: CollisionBoxArray,
                anchor: Anchor,
                featureIndex: number,
                sourceLayerIndex: number,
                bucketIndex: number,
                shaped: Object,
                boxScale: number,
                padding: number,
                alignLine: boolean,
                rotate: number) {

        this.boxStartIndex = collisionBoxArray.length;

        if (alignLine) {
            // Compute height of the shape in glyph metrics and apply collision padding.
            // Note that the pixel based 'text-padding' is applied at runtime
            let top = shaped.top;
            let bottom = shaped.bottom;
            const collisionPadding = shaped.collisionPadding;

            if (collisionPadding) {
                top -= collisionPadding[1];
                bottom += collisionPadding[3];
            }

            let height = bottom - top;

            if (height > 0) {
                // set minimum box height to avoid very many small labels
                height = Math.max(10, height);
                this.circleDiameter = height;
            }
        } else {
            let y1 = shaped.top * boxScale - padding;
            let y2 = shaped.bottom * boxScale + padding;
            let x1 = shaped.left * boxScale - padding;
            let x2 = shaped.right * boxScale + padding;

            const collisionPadding = shaped.collisionPadding;
            if (collisionPadding) {
                x1 -= collisionPadding[0] * boxScale;
                y1 -= collisionPadding[1] * boxScale;
                x2 += collisionPadding[2] * boxScale;
                y2 += collisionPadding[3] * boxScale;
            }

            if (rotate) {
                // Account for *-rotate in point collision boxes
                // See https://github.com/mapbox/mapbox-gl-js/issues/6075
                // Doesn't account for icon-text-fit

                const tl = new Point(x1, y1);
                const tr = new Point(x2, y1);
                const bl = new Point(x1, y2);
                const br = new Point(x2, y2);

                const rotateRadians = rotate * Math.PI / 180;

                tl._rotate(rotateRadians);
                tr._rotate(rotateRadians);
                bl._rotate(rotateRadians);
                br._rotate(rotateRadians);

                // Collision features require an "on-axis" geometry,
                // so take the envelope of the rotated geometry
                // (may be quite large for wide labels rotated 45 degrees)
                x1 = Math.min(tl.x, tr.x, bl.x, br.x);
                x2 = Math.max(tl.x, tr.x, bl.x, br.x);
                y1 = Math.min(tl.y, tr.y, bl.y, br.y);
                y2 = Math.max(tl.y, tr.y, bl.y, br.y);
            }
            collisionBoxArray.emplaceBack(anchor.x, anchor.y, x1, y1, x2, y2, featureIndex, sourceLayerIndex, bucketIndex);
        }

        this.boxEndIndex = collisionBoxArray.length;
    }
}

export default CollisionFeature;
