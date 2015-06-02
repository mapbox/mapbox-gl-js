'use strict';

module.exports = CircleBucket;

/**
 * A container for all circle data
 */
function CircleBucket(buffers, layoutProperties, collision, overscaling, collisionDebug) {
    this.buffers = buffers;
    this.layoutProperties = layoutProperties;
    this.collision = collision;
    this.overscaling = overscaling;
    this.collisionDebug = collisionDebug;

    this.symbolInstances = [];
}

CircleBucket.prototype.addFeatures = function() {
    console.warn('CircleBucket.prototype.addFeatures is not implemented');
};
