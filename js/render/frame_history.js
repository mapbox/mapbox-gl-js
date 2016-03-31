'use strict';

module.exports = FrameHistory;

function FrameHistory() {
    this.changeTimes = new Float64Array(256);
    this.changeOpacities = new Uint8Array(256);
    this.opacities = new Uint8ClampedArray(256);
    this.array = new Uint8Array(this.opacities.buffer);

    this.fadeDuration = 300;
    this.previousZoom = 0;
    this.firstFrame = true;
}

FrameHistory.prototype.record = function(zoom) {
    var now = Date.now();

    if (this.firstFrame) {
        now = 0;
        this.firstFrame = false;
    }

    zoom = Math.floor(zoom * 10);

    var z;
    if (zoom < this.previousZoom) {
        for (z = zoom + 1; z <= this.previousZoom; z++) {
            this.changeTimes[z] = now;
            this.changeOpacities[z] = this.opacities[z];
        }
    } else {
        for (z = zoom; z > this.previousZoom; z--) {
            this.changeTimes[z] = now;
            this.changeOpacities[z] = this.opacities[z];
        }
    }

    for (z = 0; z < 256; z++) {
        var timeSince = now - this.changeTimes[z];
        var opacityChange = timeSince / this.fadeDuration * 255;
        if (z <= zoom) {
            this.opacities[z] = this.changeOpacities[z] + opacityChange;
        } else {
            this.opacities[z] = this.changeOpacities[z] - opacityChange;
        }
    }

    this.changed = true;
    this.previousZoom = zoom;
};

FrameHistory.prototype.bind = function(gl) {
    if (!this.texture) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, 256, 1, 0, gl.ALPHA, gl.UNSIGNED_BYTE, this.array);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        if (this.changed) {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.ALPHA, gl.UNSIGNED_BYTE, this.array);
            this.changed = false;
        }
    }
};
