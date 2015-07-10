'use strict';

module.exports = drawCircles;

// TODO remove this file and call painter directly
function drawCircles(painter, layer, posMatrix, tile) {
    if (tile.buckets && tile.buffers) {
        painter.draw2(tile.buckets[layer.id], layer, tile);
    }
}
