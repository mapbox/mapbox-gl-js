// @flow

const createStructArrayType = require('../util/struct_array');
const Point = require('@mapbox/point-geometry');

export type CollisionBox = {
    anchorPoint: Point,
    anchorPointX: number,
    anchorPointY: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    featureIndex: number,
    sourceLayerIndex: number,
    bucketIndex: number,
    radius: number,
    signedDistanceFromAnchor: number
};

/**
 * A collision box represents an area of the map that that is covered by a
 * label. CollisionFeature uses one or more of these collision boxes to
 * represent all the area covered by a single label. They are used to
 * prevent collisions between labels.
 *
 * Line labels are represented by a set of these boxes spaced out along the
 * line. When we calculate collision geometries, we use the circle inscribed
 * in the box, rather than the box itself. This makes collision detection more
 * stable during rotation. The circle geometry is based solely on the line
 * geometry and the total length of the label -- individual glyph shapings
 * doesn't factor into collision detection.
 *
 * @class CollisionBoxArray
 * @private
 */

const CollisionBoxArray = createStructArrayType({
    members: [
        // the box is centered around the anchor point
        { type: 'Int16', name: 'anchorPointX' },
        { type: 'Int16', name: 'anchorPointY' },

        // distances to the edges from the anchor
        { type: 'Int16', name: 'x1' },
        { type: 'Int16', name: 'y1' },
        { type: 'Int16', name: 'x2' },
        { type: 'Int16', name: 'y2' },

        // the index of the feature in the original vectortile
        { type: 'Uint32', name: 'featureIndex' },
        // the source layer the feature appears in
        { type: 'Uint16', name: 'sourceLayerIndex' },
        // the bucket the feature appears in
        { type: 'Uint16', name: 'bucketIndex' },

        // collision circles for lines store their distance to the anchor in tile units
        // so that they can be ignored if the projected label doesn't extend into
        // the box area
        { type: 'Int16', name: 'radius' },
        { type: 'Int16', name: 'signedDistanceFromAnchor' }

    ]
});

// https://github.com/facebook/flow/issues/285
(Object.defineProperty: any)(CollisionBoxArray.prototype.StructType.prototype, 'anchorPoint', {
    get() { return new Point(this.anchorPointX, this.anchorPointY); }
});

module.exports = CollisionBoxArray;
