'use strict';

module.exports = LineAtlas;

function LineAtlas(gl) {
    this.width = 512;
    this.height = 2048;
    this.nextRow = 0;
    this.data = new Uint8Array(this.width * this.height * 4);
    this.positions = {};
    this.gl = gl;
}

LineAtlas.prototype.getPosition = function(array) {
    var position = this.positions[array];
    if (!position) {
        throw('missing dasharray');
    }
    return position;
};

LineAtlas.prototype.setDashes = function(dasharrays) {
    for (var i = 0; i < dasharrays.length; i++) {
        var dasharray = dasharrays[i];
        if (this.positions[dasharray]) continue;
        this.addDash(dasharray);
    }
    this.bind(this.gl, true);
};

LineAtlas.prototype.setPatterns = function(patterns) {
    console.log(patterns);
};

LineAtlas.prototype.addDash = function(dasharray) {

    if (this.nextRow >= this.height) {
        console.warn('LineAtlas out of space');
        return;
    }
    
    var length = 0;
    for (var i = 0; i < dasharray.length; i++) {
        length += dasharray[i];
    }

    var one = 32;
    var q = this.width / one; // 16
    var numRepeats = Math.min(1, Math.ceil(q / length));
    var pixelLength = this.width / numRepeats;
    var stretch = pixelLength / length;

    var position = this.positions[dasharray] = {
        y: (this.nextRow + one / 2) / this.height,
        width: numRepeats * length
    };

   var height = one;

    for (var y = this.nextRow; y < this.nextRow + height; y++) {
        var startIndex = y * this.width * 4;
        for (var x = 0; x < this.width; x++) {
            var index = startIndex + x * 4;
            var pos = (x % pixelLength) / stretch;

            var inside = false;
            var dist = 0;
            for (var d = 0; d < dasharray.length; d++) {
                dist += dasharray[d];
                if (pos < dist) {
                   inside = (d % 2) === 0;
                   break;
                }
            }

            if (inside) {
                this.data[index + 0] = 255;
                this.data[index + 1] = 255;
                this.data[index + 2] = 255;
                this.data[index + 3] = 255;
            }
        }
    }

    this.nextRow += height;

    return position;
};

LineAtlas.prototype.bind = function(gl, update) {
    if (!this.texture) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.data);
        gl.generateMipmap(gl.TEXTURE_2D);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        if (update) {
             gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.ALPHA, gl.UNSIGNED_BYTE, this.data);
             gl.generateMipmap(gl.TEXTURE_2D);
        }
    }
};
