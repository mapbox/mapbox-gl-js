'use strict';

module.exports = CollisionBox;

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
 * @class CollisionBox
 * @param {Point} anchorPoint The anchor point the box is centered around.
 * @param {number} x1 The distance from the anchor to the left edge.
 * @param {number} y1 The distance from the anchor to the top edge.
 * @param {number} x2 The distance from the anchor to the right edge.
 * @param {number} y2 The distance from the anchor to the bottom edge.
 * @param {number} maxScale The maximum scale this box can block other boxes at.
 * @param {VectorTileFeature} feature The VectorTileFeature that this CollisionBox was created for.
 * @param {Array<string>} layerIDs The IDs of the layers that this CollisionBox is a part of.
 * @private
 */
function CollisionBox(anchorPoint, x1, y1, x2, y2, maxScale, feature, layerIDs) {
    // the box is centered around the anchor point
    this.anchorPoint = anchorPoint;

    // distances to the edges from the anchor
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;

    // the box is only valid for scales < maxScale.
    // The box does not block other boxes at scales >= maxScale;
    this.maxScale = maxScale;

    // the index of the feature in the original vectortile
    this.feature = feature;

    // the IDs of the layers this feature collision box appears in
    this.layerIDs = layerIDs;

    // the scale at which the label can first be shown
    this.placementScale = 0;

    // rotated and scaled bbox used for indexing
    this[0] = this[1] = this[2] = this[3] = 0;
}
