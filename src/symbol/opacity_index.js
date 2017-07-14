const EXTENT = require('../data/extent');

class OpacityIndex {
    constructor(oldIndex) {
        this.index = {};
        this.minzoom = Infinity;
        this.maxzoom = -Infinity;
        this.oldIndex = oldIndex;
        this.fadeDuration = 300;
        if (oldIndex) delete oldIndex.oldIndex;
    }

    key(pos, text) {
        return `${pos.x}/${pos.y}/${pos.z}/${text}`;
    }

    convertCoord(coord, anchor, sourceMaxZoom) {
        const roundingFactor = 512 / EXTENT;
        return {
            x: Math.floor((coord.x * EXTENT + anchor.x) * roundingFactor),
            y: Math.floor((coord.y * EXTENT + anchor.y) * roundingFactor),
            z: Math.min(coord.z, sourceMaxZoom)
        };
    }

    query(coord, anchor, sourceMaxZoom, text) {
        const c = this.convertCoord(coord, anchor, sourceMaxZoom);
        for (let z = this.minzoom; z <= this.maxzoom; z++) {
            const relativeScale = Math.pow(2, z - c.z);
            const minX = Math.floor(c.x * relativeScale);
            const minY = Math.floor(c.y * relativeScale);
            const maxX = (c.x + 1) * relativeScale;
            const maxY = (c.y + 1) * relativeScale;
            for (let x = minX; x < maxX; x++) {
                for (let y = minY; y < maxY; y++) {
                    const opacity = this.index[this.key({ x: x, y: y, z: z }, text)];
                    if (opacity !== undefined) return opacity;
                }
            }
        }
    }

    insert(coord, anchor, sourceMaxZoom, opacity, text) {
        const z = Math.min(sourceMaxZoom, coord.z);
        this.minzoom = Math.min(this.minzoom, z);
        this.maxzoom = Math.max(this.maxzoom, z);
        const key = this.key(this.convertCoord(coord, anchor, sourceMaxZoom), text);
        this.index[key] = opacity;
    }

    getAndSetOpacity(coord, anchor, sourceMaxZoom, targetOpacity, text) {
        const now = Date.now();
        let previousOpacity = (this.oldIndex ? this.oldIndex.query(coord, anchor, sourceMaxZoom, text) : undefined);

        previousOpacity = previousOpacity || {
            opacity: -0,
            time: now
        };

        const increment = (now - previousOpacity.time) / this.fadeDuration * (targetOpacity === 1 ? 1 : -1);

        const newOpacity = {
            opacity: Math.max(0, Math.min(1, previousOpacity.opacity + increment)),
            target: targetOpacity,
            time: now
        };

        this.insert(coord, anchor, sourceMaxZoom, newOpacity, text);
        return newOpacity.opacity;
    }
}

class CombinedSymbolOpacityIndex {
    constructor(oldIndex) {
        this.text = new OpacityIndex(oldIndex && oldIndex.text);
        this.icon = new OpacityIndex(oldIndex && oldIndex.icon);
    }
}

module.exports = CombinedSymbolOpacityIndex;
