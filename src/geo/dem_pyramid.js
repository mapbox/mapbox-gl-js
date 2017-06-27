'use strict';
const assert = require('assert');

class Level {
    constructor(width, height, border, data) {
        assert(width > 0);
        assert(height > 0);
        this.width = width;
        this.height = height;
        this.border = border;
        this.stride = this.width + 2 * this.border;
        this.data = data || new Int32Array((this.width + 2 * this.border) * (this.height + 2 * this.border));
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
    constructor(uid, scale, levels) {
        this.uid = uid;
        this.scale = scale || 1;
        this.levels = levels ? levels : [];
        this.loaded = false;
    }

    loadFromImage(data) {
        // Build level 0
        this.levels = [ new Level(data.width, data.height, data.width / 2) ];
        const level = this.levels[0];
        const pixels = data.data;

        // unpack
        for (let y = 0; y < data.height; y++) {
            for (let x = 0; x < data.width; x++) {
                const i = y * data.width + x;
                const j = i * 4;
                level.set(x, y, this.scale * ((pixels[j] * 256 * 256 + pixels[j + 1] * 256.0 + pixels[j + 2]) / 10.0 - 10000.0));
            }
        }

        this.loaded = true;
    }

    serialize(transferables) {
        const references = {
            uid: this.uid,
            scale: this.scale,
        };

        this.levels.forEach((l, i)=>{
            if (transferables) transferables.push(l.data.buffer);
            references[i] = l.data.buffer;
        });
        return references;
    }

    backfillBorders(borderTile, dx, dy) {
        for (let l = 0; l < this.levels.length; l++) {
            const t = this.levels[l];
            const o = borderTile.levels[l];

            if (t.width !== o.width) throw new Error('level mismatch (width)');
            if (t.height !== o.height) throw new Error('level mismatch (height)');


            let _xMin = dx * t.width,
                _xMax = dx * t.width + t.width,
                _yMin = dy * t.height,
                _yMax = dy * t.height + t.height;

            switch (dx) {
            case -1:
                _xMin = _xMax - 1;
                break;
            case 1:
                _xMax = _xMin + 1;
                break;
            }

            switch (dy) {
            case -1:
                _yMin = _yMax - 1;
                break;
            case 1:
                _yMax = _yMin + 1;
                break;
            }

            const xMin = clamp(_xMin, -t.border, t.width + t.border);
            const xMax = clamp(_xMax, -t.border, t.width + t.border);
            const yMin = clamp(_yMin, -t.border, t.height + t.border);
            const yMax = clamp(_yMax, -t.border, t.height + t.border);

            const ox = -dx * t.width;
            const oy = -dy * t.height;
            for (let y = yMin; y < yMax; y++) {
                for (let x = xMin; x < xMax; x++) {
                    t.set(x, y, o.get(x + ox, y + oy));
                }
            }

        }

        function clamp(value, min, max) {
            return value < min ? min : (value > max ? max : value);
        }
    }
}


module.exports = {DEMPyramid, Level};


DEMPyramid.deserialize = function(data) {
    const levels = [];

    // TODO dont hardcode tilesize
    let tileSize = 256, i = 0;
    while (data[i]) {
        levels.push(new Level(tileSize, tileSize, tileSize / 2, new Int32Array(data[i])));
        i++;
    }
    return new DEMPyramid(data.uid, data.scale, levels);
};
