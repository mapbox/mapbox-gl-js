'use strict';

module.exports = drawTerrain;

function drawTerrain(painter, sourceCache, layer, coords){
    if (painter.isOpaquePass) return;

    const gl = painter.gl;

    painter.setDepthSublayer(0);
    painter.depthMask(false);

    for (const coord of coords) {


    }
}
