'use strict';

module.exports = LineAtlas;

function LineAtlas() {
    this.width = 512;
    this.height = 512;
    this.nextRow = 0;
    this.data = new Uint8Array(this.width * this.height * 4);
    this.dirty = false;
    this.positions = {};
}

LineAtlas.prototype.getPosition = function(array) {
    var position = this.positions[array];
    if (!position) {
        position = this.addDash(array);
    }
    return position;
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

    var n = 100;
    length *= n;
    var numRepeats = Math.floor(this.width / length);
    var stretch = this.width / (numRepeats * length);
    var stretchedLength = stretch * length;

    var position = this.positions[dasharray] = {
        y: (this.nextRow + 0.5) / this.height,
        width: numRepeats * length / n
    };
    var startIndex = this.nextRow * this.width * 4;
    this.nextRow += 2;

    for (var x = 0; x < this.width; x++) {
        var index = startIndex + x * 4;
        var pos = (x % stretchedLength) / stretch;

        var inside = false;
        for (var d = 0; d < dasharray.length; d++) {
            if (pos < n * dasharray[d]) {
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

    this.dirty = true;
    return position;
};

LineAtlas.prototype.bind = function(gl) {
    if (!this.texture || this.dirty) { // TODO
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.data);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }
    this.dirty = false;
};
