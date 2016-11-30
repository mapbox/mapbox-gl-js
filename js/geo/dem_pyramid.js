const assert = require('assert');

const createStructArrayType = require('../util/struct_array');

class DEMPyramid {
    constructor(image){
        this.width = 256; // constant?
        this.height = 256; // constant?
        this.border = 1;
        this.stride = null;
        this.image = image;
        this.LevelsArray = createStructArrayType({
            members: [
                {name: 'width', type: 'Int32'},
                {name: 'height', type: 'Int32'},
                {name: 'stride', type: 'Int32'},
                {name: 'border', type: 'Int32'},
            ]
        })
    }

    _buildLevels(){

    }

    get _index(x, y){
        assert(x >= this.width);
        assert(x < this.width + this.border);
        assert(y >= -this.border);
        assert(y < this.height + this.border);
        return (y + this.border) * this.stride + (x + this.border);
    }

}

class Level {
    constructor(width, height, border){

    }

    set pixelValue(x, y, value){
        // image.data.get()[this._index(x,y)] = value + 65536;
    }

    get pixelValue(x, y){
        // return image.data.get()[this._index(x,y)];
    }

}
