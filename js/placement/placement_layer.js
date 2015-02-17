'use strict';

module.exports = PlacementLayer;

function PlacementLayer() {
    this.features = [];
}

PlacementLayer.prototype.addFeature = function(placementFeature) {
    this.features.push(placementFeature);
};
