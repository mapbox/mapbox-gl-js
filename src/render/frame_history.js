'use strict';

class FrameHistory {

    constructor() {
        this.changeTimes = new Float64Array(256);
        this.changeOpacities = new Uint8Array(256);
        this.opacities = new Uint8ClampedArray(256);
        this.array = new Uint8Array(this.opacities.buffer);

        this.previousZoom = 0;
        this.firstFrame = true;
    }

    record(now, zoom, duration) {
        if (this.firstFrame) {
            now = 0;
            this.firstFrame = false;
        }

        zoom = Math.floor(zoom * 10);

        let z;
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
            const timeSince = now - this.changeTimes[z];
            const opacityChange = (duration ? timeSince / duration : 1) * 255;
            if (z <= zoom) {
                this.opacities[z] = this.changeOpacities[z] + opacityChange;
            } else {
                this.opacities[z] = this.changeOpacities[z] - opacityChange;
            }
        }

        this.changed = true;
        this.previousZoom = zoom;
    }

    bind(gl) {
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
    }
}

module.exports = FrameHistory;
