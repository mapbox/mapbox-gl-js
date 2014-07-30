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
        console.warn(array);
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

LineAtlas.prototype.debug = function() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    var data = this.ctx.getImageData(0, 0, this.width, this.height);
    for (var i = 0; i < this.data.length; i++) {
        data.data[i] = this.data[i];
    }
    this.ctx.putImageData(data, 0, 0);
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = 0;
    this.canvas.style.left = 0;
    this.canvas.style.background = '#ff0';
};

LineAtlas.prototype.setPatterns = function(patterns, sprite) {

    var img = sprite.img.getData();
    for (var i = 0; i < patterns.length; i++) {
        var pattern = patterns[i];
        if (this.positions[pattern]) continue;
        var data = sprite.data[pattern];
        this.addPattern(pattern, data, img, sprite.img.width);
    }

    this.bind(this.gl, true);
    this.debug();
};

LineAtlas.prototype.addPattern = function(pattern, data, img, imgWidth) {
    var powOf2Height = Math.pow(2, Math.ceil(Math.log(data.height) / Math.LN2));
    this.nextRow = Math.ceil(this.nextRow / powOf2Height) * powOf2Height;

    if (this.nextRow >= this.height) {
        console.warn('LineAtlas out of space');
        return;
    }

    var yOffset = Math.floor((powOf2Height - data.height) / 2);

    this.positions[pattern] = {
        y: (this.nextRow + powOf2Height / 2) / this.height,
        height: data.height / this.height,
        width: this.width / data.width
    };

    for (var y = 0; y < data.height; y++) {
        var startIndex = (y + yOffset + this.nextRow) * this.width * 4;
        for (var x = 0; x < this.width; x++) {
            var index = startIndex + x * 4;
            var imgX = (x % data.width) + data.x;
            var imgY = data.y + y;
            var imgIndex = (imgWidth * imgY + imgX) * 4;

            this.data[index + 0] = img[imgIndex + 0];
            this.data[index + 1] = img[imgIndex + 1];
            this.data[index + 2] = img[imgIndex + 2];
            this.data[index + 3] = img[imgIndex + 3];
        }
    }

    this.nextRow += powOf2Height;
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
        height: one / this.height,
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
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.data);
        gl.generateMipmap(gl.TEXTURE_2D);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        if (update) {
             gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, this.data);
             gl.generateMipmap(gl.TEXTURE_2D);
        }
    }
};
