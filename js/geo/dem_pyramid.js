const assert = require('assert');

class DEMPyramid {
    constructor(imageData){
        this.width = 256; // constant?
        this.height = 256; // constant?
        this.border = 1;
        this.stride = null;
        this.image = new DEMImage(this.width, this.height, image);
        this.levels = [];
    }

    buildLevels(){
        while (true) {
            const prev = levels[levels.length-1];
            const width = Math.ceil(prev.width / 2);
            const height = Math.ceil(prev.height / 2);
            const border = Math.max(Math.ceil(prev.border / 2), 1);

            if (width == 1 || height == 1) {
                break;
            }
            let next = new Level(width, height, border)
            prev.resample(next);
            this.levels.push(next);
        }

        // Build remaining two levels. They aren't actually used in rendering, but we
        // need them for OpenGL's mipmapping feature.
        levels.push(new Level(2, 2, 0));
        levels.push(new Level(1, 1, 0));
    }
}

class Level {
    constructor(width, height, border){
        assert(width > 0);
        assert(height > 0);
        this.width = width;
        this.height = height;
        this.border = border;
        this.stride = width + 2 * border;
        this.image = new DEMImage(stride, height + 2 * border);
    }

    setPixelValue(x, y, value){
        image.data[this._index(x,y)] = value + 65536;
    }

    getPixelValue(x, y){
        return image.data[this._index(x,y)] - 65536;
    }

    _index(x,y) {
        assert(x >= -this.border);
        assert(x < this.width + this.border);
        assert(y >= -this.border);
        assert(y < this.height + this.border);
        return (y + this.border) * this.stride + (x + this.border);
    }

    _resample(target){
        assert(target instanceof Level);
        for (let y = 0; y < target.height; y++) {
            const fy = y * 2;
            for (let x = 0; x < target.width; x++) {
                const fx = x * 2;
                target.setPixelValue(x, y, (this.getPixelValue(fx, fy) + this.getPixelValue(fx + 1, fy) + this.getPixelValue(fx, fy + 1) + this.getPixelValue(fx + 1, fy + 1)) / 4);
            }
        }
    }
}

class DEMImage {
    constructor(width, height, data) {
        this.width = width;
        this.height = height;
        this.data = data ? new Uint8ClampedArray(data) : new Uint8ClampedArray();
    }
}

module.exports = DEMPyramid;
