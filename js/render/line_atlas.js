'use strict';

module.exports = LineAtlas;

function LineAtlas(width, height) {
    this.width = width;
    this.height = height;
    this.nextRow = 0;

    this.bytes = 4;
    this.data = new Uint8Array(this.width * this.height * this.bytes);

    this.positions = {};
}

LineAtlas.prototype.setSprite = function(sprite) {
    this.sprite = sprite;
};

LineAtlas.prototype.getImagePosition = function(pattern) {

    if (!this.positions[pattern]) {
        this.positions[pattern] = this.addImage(pattern, this.sprite);
    }
    return this.positions[pattern];
};

LineAtlas.prototype.addImage = function(pattern, sprite) {

    var data = sprite.data[pattern];
    var img = sprite.img.getData();
    var imgWidth = sprite.img.width;

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

    var pos = {
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

    return pos;
};

LineAtlas.prototype.getDash = function(dasharray, round) {
    var key = dasharray.join(",") + round;

    if (!this.positions[key]) {
        this.positions[key] = this.addDash(dasharray, round);
    } 
    return this.positions[key];
};

LineAtlas.prototype.addDash = function(dasharray, round) {

    var n = round ? 7 : 0;
    var height = 2 * n + 1;
    var offset = 128;

    if (this.nextRow + height > this.height) {
        console.warn('LineAtlas out of space');
        return;
    }

    var length = 0;
    for (var i = 0; i < dasharray.length; i++) {
        length += dasharray[i];
    }

    var stretch = this.width / length;
    var halfWidth = stretch / 2;

    for (var y = -n; y <= n; y++) {
        var row = this.nextRow + n + y;
        var index = this.width * row;

        var left = 0;
        var right = dasharray[0];
        var partIndex = 1;

        for (var x = 0; x < this.width; x++) {
            
            while (right < x / stretch) {
                left = right;
                right = right + dasharray[partIndex];
                partIndex++;
            }

            var distLeft = Math.abs(x - left * stretch);
            var distRight = Math.abs(x - right * stretch);
            var dist = Math.min(distLeft, distRight);
            var inside = (partIndex % 2) === 1;
            var signedDistance;

            if (round) {
                // Add circle caps
                var distMiddle = n ? y / n * (halfWidth + 1) : 0;
                if (inside) {
                    var distEdge = halfWidth - Math.abs(distMiddle);
                    signedDistance = Math.sqrt(dist * dist + distEdge * distEdge);
                } else {
                    signedDistance = halfWidth - Math.sqrt(dist * dist + distMiddle * distMiddle);
                }
            } else {
                signedDistance = (inside ? 1 : -1) * dist;
            }

            this.data[3 + (index + x) * 4] = Math.max(0, Math.min(255, signedDistance + offset));
        }
    }

    var pos = {
        y: (this.nextRow + n + 0.5) / this.height,
        height: 2 * n / this.height,
        width: length
    };

    this.nextRow += height;
    this.dirty = true;

    return pos;
};

LineAtlas.prototype.bind = function(gl) {
    if (!this.texture) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.data);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        if (this.dirty) {
            this.dirty = false;
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, this.data);
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
