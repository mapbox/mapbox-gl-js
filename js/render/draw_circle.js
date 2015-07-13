'use strict';

module.exports = drawCircles;

function drawCircles(painter, layer, posMatrix, tile) {
    painter.draw2(tile.buckets && tile.buckets[layer.id], layer, tile);
}
