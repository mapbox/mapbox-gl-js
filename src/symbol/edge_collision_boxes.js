'use strict';

const EXTENT = require('../data/extent');

function initializeEdgeCollisionBoxes(collisionBoxArray) {
    if (collisionBoxArray.length === 0) {
        // the first time collisionBoxArray is passed to a CollisionTile

        // tempCollisionBox
        collisionBoxArray.emplaceBack();

        const maxInt16 = 32767;
        //left
        collisionBoxArray.emplaceBack(0, 0, 0, -maxInt16, 0, maxInt16, maxInt16,
                0, 0, 0, 0, 0, 0, 0, 0,
                0);
        // right
        collisionBoxArray.emplaceBack(EXTENT, 0, 0, -maxInt16, 0, maxInt16, maxInt16,
                0, 0, 0, 0, 0, 0, 0, 0,
                0);
        // top
        collisionBoxArray.emplaceBack(0, 0, -maxInt16, 0, maxInt16, 0, maxInt16,
                0, 0, 0, 0, 0, 0, 0, 0,
                0);
        // bottom
        collisionBoxArray.emplaceBack(0, EXTENT, -maxInt16, 0, maxInt16, 0, maxInt16,
                0, 0, 0, 0, 0, 0, 0, 0,
                0);
    }
}

module.exports = initializeEdgeCollisionBoxes;
