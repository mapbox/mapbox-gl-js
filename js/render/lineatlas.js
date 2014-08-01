'use strict';

module.exports = LineAtlas;

function LineAtlas(gl, sdf) {
    this.sdf = sdf;
    this.width = 512;
    this.height = 512;
    this.nextRow = 0;

    if (sdf) {
        this.bytes = 1;
        this.type = gl.ALPHA;
        this.mipmap = false;
    } else {
        this.bytes = 4;
        this.type = gl.RGBA;
        this.mipmap = true;
    }

    this.data = new Uint8Array(this.width * this.height * this.bytes);
    this.positions = {};
    this.gl = gl;
}

LineAtlas.prototype.getPosition = function(name) {
    return this.positions[name];
};

LineAtlas.prototype.setImages = function(patterns, sprite) {

    var img = sprite.img.getData();
    for (var i = 0; i < patterns.length; i++) {
        var pattern = patterns[i];
        if (this.positions[pattern]) continue;
        var data = sprite.data[pattern];
        this.addImage(pattern, data, img, sprite.img.width);
    }

    this.bind(this.gl, true);
};

LineAtlas.prototype.setDashes = function(dasharrays) {
    for (var i = 0; i < dasharrays.length; i++) {
        var dasharray = dasharrays[i];
        if (this.positions[dasharray]) continue;
        this.addDash(dasharray);
    }
    this.bind(this.gl, true);
};

LineAtlas.prototype.addImage = function(pattern, data, img, imgWidth) {

    // the smallest power of 2 number that is >= the pattern's height
    var powOf2Height = Math.pow(2, Math.ceil(Math.log(data.height) / Math.LN2));
    // find the starting row that is a multiple of that power of 2 so
    // that the pattern doesn't pollute neighbours when mipmapped
    this.nextRow = Math.ceil(this.nextRow / powOf2Height) * powOf2Height;

    if (this.nextRow + powOf2Height > this.height) {
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
            var imgIndex = (imgWidth * imgY + imgX) * this.bytes;

            this.data[index + 0] = img[imgIndex + 0];
            this.data[index + 1] = img[imgIndex + 1];
            this.data[index + 2] = img[imgIndex + 2];
            this.data[index + 3] = img[imgIndex + 3];
        }
    }

    this.nextRow += powOf2Height;
};

LineAtlas.prototype.addDash = function(dasharray) {

    var round = false;
    var n = round ? 7 : 0;
    var height = 2 * n + 1;

    if (this.nextRow + height > this.height) {
        console.warn('LineAtlas out of space');
        return;
    }

    var edges = [0];
    var length = 0;
    for (var i = 0; i < dasharray.length; i++) {
        length += dasharray[i];
        edges.push(length);
    }

    var stretch = this.width / length;
    var halfWidth = stretch / 2;

    for (var y = -n; y <= n; y++) {
        var row = this.nextRow + n + y;
        var index = this.width * row;
        var left = 0;
        var right = 1;

        for (var x = 0; x < this.width; x++) {
            
            while (edges[right] < x / stretch) {
                left++;
                right++;
            }

            var distLeft = Math.abs(x - edges[left] * stretch);
            var distRight = Math.abs(x - edges[right] * stretch);
            var dist = Math.min(distLeft, distRight);
            var inside = (left % 2) === 0;

            var distMiddle = n ? y / n * halfWidth : 0;
            var distEdge = halfWidth - Math.abs(distMiddle);
            var signedDistance;

            if (round) {
                // Add circle caps
                if (inside) {
                    signedDistance = Math.sqrt(dist * dist + distEdge * distEdge);
                } else {
                    signedDistance = halfWidth - Math.sqrt(dist * dist + distMiddle * distMiddle);
                }
            } else {
                signedDistance = (inside ? 1 : -1) * dist;
            }

            var offset = 128;
            this.data[index + x] = Math.max(0, Math.min(255, signedDistance + offset));
        }
    }

    this.positions[dasharray] = {
        y: (this.nextRow + n + 0.5) / this.height,
        height: 2 * n / this.height,
        width: length
    };

    this.nextRow += height;
};

LineAtlas.prototype.bind = function(gl, update) {
    if (!this.texture) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, this.type, this.width, this.height, 0, this.type, gl.UNSIGNED_BYTE, this.data);
        if (this.mipmap) gl.generateMipmap(gl.TEXTURE_2D);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        if (update) {
             gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, this.type, gl.UNSIGNED_BYTE, this.data);
             if (this.mipmap) gl.generateMipmap(gl.TEXTURE_2D);
        }
    }
};

LineAtlas.prototype.debug = function() {

    var canvas = document.createElement('canvas');

    document.body.appendChild(canvas);
    canvas.style.position = 'absolute';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.background = '#ff0';

    canvas.width = this.width;
    canvas.height = this.height;

    var ctx = canvas.getContext('2d');
    var data = ctx.getImageData(0, 0, this.width, this.height);
    for (var i = 0; i < this.data.length; i++) {
        if (this.sdf) {
            var k = i * 4;
            data.data[k] = data.data[k + 1] = data.data[k + 2] = 0;
            data.data[k + 3] = this.data[i];
        } else {
            data.data[i] = this.data[i];
        }
    }
    ctx.putImageData(data, 0, 0);
};
