const assert = require('assert');
// if (typeof window === 'undefined') {
    // const Canvas = require('canvas');
    // const Image = Canvas.Image;
// } else {
    const Canvas = function(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
// }
// const Canvas = require('canvas');

class DEMPyramid {
    constructor(scale){
        this.scale = scale || 1;
        this.levels = [];
        this.loaded = false;
    }

    buildLevels(){
        for (var i = 0; this.levels[i].width > 2; i++) {
            var prev = this.levels[i];
            const width = Math.ceil(prev.width / 2);
            const height = Math.ceil(prev.height / 2);
            var current = this.levels[i + 1] = new Level(width, height, Math.max(prev.border/2, 1));
            prev.resample(current);
        }
        // Build remaining two levels. They aren't actually used in rendering, but we
        // need them for OpenGL's mipmapping feature.
        this.levels.push(new Level(2, 2, 0));
        this.levels.push(new Level(1, 1, 0));
    }

    decodeBleed(pbf){
        for (var l = 0; l < this.levels.length; l++) {
            var level = this.levels[l];
            if (level.width <= 2 || level.height <= 2) {
                break;
            }

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

    loadFromImage(img) {
        // Build level 0
        this.levels = [ new Level(img.width, img.height, 1) ];
        var level = this.levels[0];

        var canvas = new Canvas();
        canvas.width = img.width;
        canvas.height = img.height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        var data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var pixels = data.data;

        // unpack
        for (var y = 0; y < data.height; y++) {
            for (var x = 0; x < data.width; x++) {
                const i = y * data.width + x;
                const j = i * 4;
                level.set(x, y, this.scale * ((pixels[j] * 256 * 256 + pixels[j + 1] * 256.0 + pixels[j + 2]) / 10.0 - 10000.0));
            }
        }

        this.buildLevels();

        this.loaded = true;
    };

}


class Level {
    constructor(width, height, border){
        assert(width > 0);
        assert(height > 0);
        this.width = width;
        this.height = height;
        this.border = border;
        this.stride = this.width + 2 * this.border;
        this.data = new Int32Array((this.width + 2 * this.border) * (this.height + 2 * this.border));
    }

    set(x, y, value){
        this.data[this.idx(x, y)] = value + 65536;
    }

    get(x, y){
        return this.data[this.idx(x, y)] - 65536;
    }

    idx(x,y) {
        assert(x >= -this.border);
        assert(x < this.width + this.border);
        assert(y >= -this.border);
        assert(y < this.height + this.border);
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
