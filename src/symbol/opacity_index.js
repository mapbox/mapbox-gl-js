const EXTENT = require('../data/extent');

class OpacityIndex {
    constructor(now, fadeDuration, oldIndex) {
        this.index = {};
        this.minzoom = Infinity;
        this.maxzoom = -Infinity;
        this.oldIndex = oldIndex;

        this.now = now;
        this.fadeDuration = fadeDuration;
        this.increment = (this.now - (this.oldIndex ? this.oldIndex.now : 0)) / this.fadeDuration;

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

        let newOpacity;
        if (this.query(coord, anchor, sourceMaxZoom, text) !== undefined) {
            // if this label already exists in a different tile, switch it to 0 instantly
            newOpacity = {
                opacity: 0,
                targetOpacity: 0
            };
        } else {
            const previous = (this.oldIndex ? this.oldIndex.query(coord, anchor, sourceMaxZoom, text) : undefined) || {
                opacity: 0,
                targetOpacity: 0
            };

            newOpacity = {
                targetOpacity: targetOpacity,
                opacity: Math.max(0, Math.min(1, previous.opacity + (previous.targetOpacity === 1 ? this.increment : -this.increment)))
            };
        }

        this.insert(coord, anchor, sourceMaxZoom, newOpacity, text);
        return newOpacity.opacity;
    }
}

class CombinedSymbolOpacityIndex {
    constructor(oldIndex) {
        this.now = Date.now();
        this.fadeDuration = 300;
        this.text = new OpacityIndex(this.now, this.fadeDuration, oldIndex && oldIndex.text);
        this.icon = new OpacityIndex(this.now, this.fadeDuration, oldIndex && oldIndex.icon);
    }

    getChangeSince(time) {
        return (time - this.now) / this.fadeDuration;
    }
}

module.exports = CombinedSymbolOpacityIndex;
