'use strict';

module.exports = CollisionBox;

function CollisionBox(anchor, x1, y1, x2, y2, maxScale) {
    // the box is centered around the anchor point
    this.anchor = anchor;

    // distances to the edges from the anchor
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;

    // the box is only valid for scales < maxScale.
    // The box does not block other boxes at scales >= maxScale;
    this.maxScale = maxScale;

    // the scale at which the label can first be shown
    this.placementScale = 0;

    // rotated and scaled bbox used for indexing
    this[0] = this[1] = this[2] = this[3] = 0;
}
