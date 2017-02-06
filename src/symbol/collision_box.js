'use strict';

const createStructArrayType = require('../util/struct_array');
const Point = require('point-geometry');

/**
 * A collision box represents an area of the map that that is covered by a
 * label. CollisionFeature uses one or more of these collision boxes to
 * represent all the area covered by a single label. They are used to
 * prevent collisions between labels.
 *
 * A collision box actually represents a 3d volume. The first two dimensions,
 * x and y, are specified with `anchor` along with `x1`, `y1`, `x2`, `y2`.
 * The third dimension, zoom, is limited by `maxScale` which determines
 * how far in the z dimensions the box extends.
 *
 * As you zoom in on a map, all points on the map get further and further apart
 * but labels stay roughly the same size. Labels cover less real world area on
 * the map at higher zoom levels than they do at lower zoom levels. This is why
 * areas are are represented with an anchor point and offsets from that point
 * instead of just using four absolute points.
 *
 * Line labels are represented by a set of these boxes spaced out along a line.
 * When you zoom in, line labels cover less real world distance along the line
 * than they used to. Collision boxes near the edges that used to cover label
 * no longer do. If a box doesn't cover the label anymore it should be ignored
 * when doing collision checks. `maxScale` is how much you can scale the map
 * before the label isn't within the box anymore.
 * For example
 * lower zoom:
 * https://cloud.githubusercontent.com/assets/1421652/8060094/4d975f76-0e91-11e5-84b1-4edeb30a5875.png
 * slightly higher zoom:
 * https://cloud.githubusercontent.com/assets/1421652/8060061/26ae1c38-0e91-11e5-8c5a-9f380bf29f0a.png
 * In the zoomed in image the two grey boxes on either side don't cover the
 * label anymore. Their maxScale is smaller than the current scale.
 *
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

        // the box is only valid for scales < maxScale.
        // The box does not block other boxes at scales >= maxScale;
        { type: 'Float32', name: 'maxScale' },

        // the index of the feature in the original vectortile
        { type: 'Uint32', name: 'featureIndex' },
        // the source layer the feature appears in
        { type: 'Uint16', name: 'sourceLayerIndex' },
        // the bucket the feature appears in
        { type: 'Uint16', name: 'bucketIndex' },

        // rotated and scaled bbox used for indexing
        { type: 'Int16', name: 'bbox0' },
        { type: 'Int16', name: 'bbox1' },
        { type: 'Int16', name: 'bbox2' },
        { type: 'Int16', name: 'bbox3' },

        { type: 'Float32', name: 'placementScale' }
    ]
});

Object.defineProperty(CollisionBoxArray.prototype.StructType.prototype, 'anchorPoint', {
    get() { return new Point(this.anchorPointX, this.anchorPointY); }
});

module.exports = CollisionBoxArray;
