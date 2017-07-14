
/**
 * A CollisionFeature represents the area of the tile covered by a single label.
 * It is used with CollisionTile to check if the label overlaps with any
 * previous labels. A CollisionFeature is mostly just a set of CollisionBox
 * objects.
 *
 * @private
 */
class CollisionFeature {
    /**
     * Create a CollisionFeature, adding its collision box data to the given collisionBoxArray in the process.
     *
     * @param {Array<Point>} line The geometry the label is placed on.
     * @param {Anchor} anchor The point along the line around which the label is anchored.
     * @param {VectorTileFeature} feature The VectorTileFeature that this CollisionFeature was created for.
     * @param {Array<string>} layerIDs The IDs of the layers that this CollisionFeature is a part of.
     * @param {Object} shaped The text or icon shaping results.
     * @param {number} boxScale A magic number used to convert from glyph metrics units to geometry units.
     * @param {number} padding The amount of padding to add around the label edges.
     * @param {boolean} alignLine Whether the label is aligned with the line or the viewport.
     */
    constructor(collisionBoxArray, line, anchor, featureIndex, sourceLayerIndex, bucketIndex, shaped, boxScale, padding, alignLine, straight) {
        const y1 = shaped.top * boxScale - padding;
        const y2 = shaped.bottom * boxScale + padding;
        const x1 = shaped.left * boxScale - padding;
        const x2 = shaped.right * boxScale + padding;

        this.boxStartIndex = collisionBoxArray.length;

        if (alignLine) {

            let height = y2 - y1;
            const length = x2 - x1;

            if (height > 0) {
                // set minimum box height to avoid very many small labels
                height = Math.max(10 * boxScale, height);

                if (straight) {
                    // used for icon labels that are aligned with the line, but don't curve along it
                    const vector = line[anchor.segment + 1].sub(line[anchor.segment])._unit()._mult(length);
                    const straightLine = [anchor.sub(vector), anchor.add(vector)];
                    this._addLineCollisionBoxes(collisionBoxArray, straightLine, anchor, 0, length, height, featureIndex, sourceLayerIndex, bucketIndex);
                } else {
                    // used for text labels that curve along a line
                    this._addLineCollisionBoxes(collisionBoxArray, line, anchor, anchor.segment, length, height, featureIndex, sourceLayerIndex, bucketIndex);
                }
            }

        } else {
            collisionBoxArray.emplaceBack(anchor.x, anchor.y, 0, 0, x1, y1, x2, y2, Infinity, Infinity, featureIndex, sourceLayerIndex, bucketIndex,
                0, 0, 0, 0, 0);
        }

        this.boxEndIndex = collisionBoxArray.length;
    }

    /**
     * Create a set of CollisionBox objects for a line.
     *
     * @param {Array<Point>} line
     * @param {Anchor} anchor
     * @param {number} labelLength The length of the label in geometry units.
     * @param {Anchor} anchor The point along the line around which the label is anchored.
     * @param {VectorTileFeature} feature The VectorTileFeature that this CollisionFeature was created for.
     * @param {number} boxSize The size of the collision boxes that will be created.
     *
     * @private
     */
    _addLineCollisionBoxes(collisionBoxArray, line, anchor, segment, labelLength, boxSize, featureIndex, sourceLayerIndex, bucketIndex) {
        const step = boxSize / 2;
        const nBoxes = Math.floor(labelLength / step);
        // We calculate line collision boxes out to 300% of what would normally be our
        // max size, to allow collision detection to work on labels that expand as
        // they move into the distance
        const nPitchPaddingBoxes = Math.floor(nBoxes / 2);

        // offset the center of the first box by half a box so that the edge of the
        // box is at the edge of the label.
        const firstBoxOffset = -boxSize / 2;

        let p = anchor;
        let index = segment + 1;
        let anchorDistance = firstBoxOffset;
        const labelStartDistance = -labelLength / 2;
        const paddingStartDistance = labelStartDistance - labelLength / 8;

        // move backwards along the line to the first segment the label appears on
        do {
            index--;

            if (index < 0) {
                if (anchorDistance > labelStartDistance) {
                    // there isn't enough room for the label after the beginning of the line
                    // checkMaxAngle should have already caught this
                    return;
                } else {
                    // The line doesn't extend far enough back for all of our padding,
                    // but we got far enough to show the label under most conditions.
                    index = 0;
                    break;
                }
            } else {
                anchorDistance -= line[index].dist(p);
                p = line[index];
            }
        } while (anchorDistance > paddingStartDistance);

        let segmentLength = line[index].dist(line[index + 1]);

        for (let i = -nPitchPaddingBoxes; i < nBoxes + nPitchPaddingBoxes; i++) {

            // the distance the box will be from the anchor
            const boxOffset = i * step;
            let boxDistanceToAnchor = labelStartDistance + boxOffset;

            // make the distance between pitch padding boxes bigger
            if (boxOffset < 0) boxDistanceToAnchor += boxOffset;
            if (boxOffset > labelLength) boxDistanceToAnchor += boxOffset - labelLength;

            if (boxDistanceToAnchor < anchorDistance) {
                // The line doesn't extend far enough back for this box, skip it
                // (This could allow for line collisions on distant tiles)
                continue;
            }

            // the box is not on the current segment. Move to the next segment.
            while (anchorDistance + segmentLength < boxDistanceToAnchor) {
                anchorDistance += segmentLength;
                index++;

                // There isn't enough room before the end of the line.
                if (index + 1 >= line.length) return;

                segmentLength = line[index].dist(line[index + 1]);
            }

            // the distance the box will be from the beginning of the segment
            const segmentBoxDistance = boxDistanceToAnchor - anchorDistance;

            const p0 = line[index];
            const p1 = line[index + 1];
            const boxAnchorPoint = p1.sub(p0)._unit()._mult(segmentBoxDistance)._add(p0)._round();

            // Distance from label anchor point to inner (towards center) edge of this box
            // The tricky thing here is that box positioning doesn't change with scale,
            // but box size does change with scale.
            // Technically, distanceToInnerEdge should be:
            // Math.max(Math.abs(boxDistanceToAnchor - firstBoxOffset) - (step / scale), 0);
            // But using that formula would make solving for maxScale more difficult, so we
            // approximate with scale=2.
            // This makes our calculation spot-on at scale=2, and on the conservative side for
            // lower scales
            const distanceToInnerEdge = Math.max(Math.abs(boxDistanceToAnchor - firstBoxOffset) - step / 2, 0);
            let maxScale = labelLength / 2 / distanceToInnerEdge;

            // The box maxScale calculations are designed to be conservative on collisions in the scale range
            // [1,2]. At scale=1, each box has 50% overlap, and at scale=2, the boxes are lined up edge
            // to edge (beyond scale 2, gaps start to appear, which could potentially allow missed collisions).
            // We add "pitch padding" boxes to the left and right to handle effective underzooming
            // (scale < 1) when labels are in the distance. The overlap approximation could cause us to use
            // these boxes when the scale is greater than 1, but we prevent that because we know
            // they're only necessary for scales less than one.
            // This preserves the pre-pitch-padding behavior for unpitched maps.
            if (i < 0 || i >= nBoxes) {
                maxScale = Math.min(maxScale, 0.99);
            }

            collisionBoxArray.emplaceBack(boxAnchorPoint.x, boxAnchorPoint.y,
                boxAnchorPoint.x - anchor.x, boxAnchorPoint.y - anchor.y,
                -boxSize / 2, -boxSize / 2, boxSize / 2, boxSize / 2, maxScale, maxScale,
                featureIndex, sourceLayerIndex, bucketIndex,
                0, 0, 0, 0, 0);
        }
    }
}

module.exports = CollisionFeature;
