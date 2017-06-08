'use strict';

const Texture = require('./texture');

class FrameHistory {

    constructor() {
        this.changeTimes = new Float64Array(256);
        this.changeOpacities = new Uint8Array(256);
        this.opacities = new Uint8ClampedArray(256);
        this.array = new Uint8Array(this.opacities.buffer);

        this.previousZoom = 0;
        this.firstFrame = true;
        this.dirty = true;
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

        this.dirty = true;
        this.previousZoom = zoom;
    }

    bind(gl) {
        if (!this.texture) {
            this.texture = new Texture(gl, gl.CLAMP_TO_EDGE, gl.LINEAR, gl.LINEAR);
        } else {
            this.texture.bind();
        }
        if (this.dirty) {
            this.texture.setData(gl.ALPHA, 256, 1, this.array);
            this.dirty = true;
        }
    }
}

module.exports = FrameHistory;
