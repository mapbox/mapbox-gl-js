'use strict';
const window = require('../util/window');
const assert = require('assert');
const browser = require('../util/browser');


class Level {
    constructor(width, height, border) {
        assert(width > 0);
        assert(height > 0);
        this.width = width;
        this.height = height;
        this.border = border;
        this.stride = this.width + 2 * this.border;
        this.data = new Int32Array((this.width + 2 * this.border) * (this.height + 2 * this.border));
    }

    set(x, y, value) {
        this.data[this.idx(x, y)] = value + 65536;
    }

    get(x, y) {
        return this.data[this.idx(x, y)] - 65536;
    }

    idx(x, y) {
        assert(x >= -this.border);
        assert(x < this.width + this.border);
        assert(y >= -this.border);
        assert(y < this.height + this.border);
        return (y + this.border) * this.stride + (x + this.border);
    }

    resample(target) {
        assert(target instanceof Level);
        for (let y = 0; y < target.height; y++) {
            const fy = y * 2;
            for (let x = 0; x < target.width; x++) {
                const fx = x * 2;
                target.set(x, y, (this.get(fx, fy) + this.get(fx + 1, fy) + this.get(fx, fy + 1) + this.get(fx + 1, fy + 1)) / 4);
            }
        }
    }


}

class DEMPyramid {
    constructor(scale) {
        this.scale = scale || 1;
        this.levels = [];
        this.loaded = false;
    }

    buildLevels() {
        for (let i = 0; this.levels[i].width > 2; i++) {
            const prev = this.levels[i];
            const width = Math.ceil(prev.width / 2);
            const height = Math.ceil(prev.height / 2);
            const next =  new Level(width, height, Math.max(prev.border / 2, 1));
            prev.resample(next);
            this.levels.push(next);
        }
        // Build remaining two levels. They aren't actually used in rendering, but we
        // need them for OpenGL's mipmapping feature.
        this.levels.push(new Level(2, 2, 0));
        this.levels.push(new Level(1, 1, 0));
    }

    decodeBleed(pbf) {
        for (let l = 0; l < this.levels.length; l++) {
            const level = this.levels[l];
            if (level.width <= 2 || level.height <= 2) {
                break;
            }

            let x = -1;
            let y = -1;
            let prev = 0;
            // Encode left column
            while (y < level.height) {
                level.set(x, y, (prev = pbf.readSVarint() + prev));
                y++;
            }

            // Encode bottom row
            while (x < level.width) {
                level.set(x, y, (prev = pbf.readSVarint() + prev));
                x++;
            }

            // Encode right column
            while (y > -1) {
                level.set(x, y, (prev = pbf.readSVarint() + prev));
                y--;
            }

            // Encode top row
            while (x > -1) {
                level.set(x, y, (prev = pbf.readSVarint() + prev));
                x--;
            }
        }
    }

    loadFromImage(img) {
        // Build level 0
        this.levels = [ new Level(img.width, img.height, 1) ];
        const level = this.levels[0];
        const data = browser.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = data.data;

        // unpack
        for (let y = 0; y < data.height; y++) {
            for (let x = 0; x < data.width; x++) {
                const i = y * data.width + x;
                const j = i * 4;
                level.set(x, y, this.scale * ((pixels[j] * 256 * 256 + pixels[j + 1] * 256.0 + pixels[j + 2]) / 10.0 - 10000.0));
            }
        }

        this.buildLevels();

        this.loaded = true;
    }

}



module.exports = {DEMPyramid, Level};
