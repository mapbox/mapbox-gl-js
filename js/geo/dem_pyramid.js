const assert = require('assert');

class DEMPyramid {
    constructor(scale){
        this.scale = scale || 1;
        this.levels = [];
    }

    buildLevels(){
        for (var i = 0; this.levels[i].width > 1; i++) {
            var prev = this.levels[i];
            const width = Math.ceil(prev.width / 2);
            const height = Math.ceil(prev.height / 2);
            var current = this.levels[i + 1] = new Level(width, height, 1);
            prev.resample(current);
        }
        // Build remaining two levels. They aren't actually used in rendering, but we
        // need them for OpenGL's mipmapping feature.
        // this.levels.push(new Level(2, 2, 0));
        // this.levels.push(new Level(1, 1, 0));
    }

    decodeBleed(pbf){
        for (var l = 0; l < this.levels.length; l++) {
            var level = this.levels[l];

            var x = -1;
            var y = -1;
            var prev = 0;
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
}

class Level {
    constructor(width, height, border){
        assert(width > 0);
        assert(height > 0);
        this.width = width;
        this.height = height;
        this.border = border;
        this.stride = this.width + 2 * this.border;
        this.data = new Int16Array((this.width + 2 * this.border) * (this.height + 2 * this.border));
    }

    set(x, y, value){
        this.data[this.idx(x, y)] = value;
    }

    get(x, y){
        return this.data[this.idx(x, y)];
    }

    idx(x,y) {
        // assert(x >= -this.border);
        // assert(x < this.width + this.border);
        // assert(y >= -this.border);
        // assert(y < this.height + this.border);
        return (y + this.border) * this.stride + (x + this.border);
    }

    resample(target){
        assert(target instanceof Level);
        for (var y = 0; y < target.height; y++) {
            const fy = y * 2;
            for (var x = 0; x < target.width; x++) {
                const fx = x * 2;
                target.set(x, y, (this.get(fx, fy) + this.get(fx + 1, fy) + this.get(fx, fy + 1) + this.get(fx + 1, fy + 1)) / 4);
            }
        }
    }


}


module.exports = {DEMPyramid, Level};
