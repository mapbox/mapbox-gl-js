'use strict';

module.exports = drawCircles;

// TODO remove this file and call painter directly
function drawCircles(painter, layer, posMatrix, tile) {
    painter.draw2(tile.buckets && tile.buckets[layer.id], layer, tile);
}
