// @flow

import {warnOnce} from '../util/util';

import type Context from '../gl/context';

/**
 * A LineAtlas lets us reuse rendered dashed lines
 * by writing many of them to a texture and then fetching their positions
 * using .getDash.
 *
 * @param {number} width
 * @param {number} height
 * @private
 */
class LineAtlas {
    width: number;
    height: number;
    nextRow: number;
    bytes: number;
    data: Uint8Array;
    dashEntry: {[_: string]: any};
    dirty: boolean;
    texture: WebGLTexture;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.nextRow = 0;

        this.data = new Uint8Array(this.width * this.height);

        this.dashEntry = {};
    }

    /**
     * Get or create a dash line pattern.
     *
     * @param {Array<number>} dasharray
     * @param {boolean} round whether to add circle caps in between dash segments
     * @returns {Object} position of dash texture in { y, height, width }
     * @private
     */
    getDash(dasharray: Array<number>, round: boolean) {
        const key = dasharray.join(",") + String(round);

        if (!this.dashEntry[key]) {
            this.dashEntry[key] = this.addDash(dasharray, round);
        }
        return this.dashEntry[key];
    }

    getDashRanges(dasharray: Array<number>, lineAtlasWidth: number, stretch: number) {
        // If dasharray has an odd length, both the first and last parts
        // are dashes and should be joined seamlessly.
        const oddDashArray = dasharray.length % 2 === 1;

        const ranges = [];

        let left = oddDashArray ? -dasharray[dasharray.length - 1] * stretch : 0;
        let right = dasharray[0] * stretch;
        let isDash = true;

        ranges.push({left, right, isDash, zeroLength: dasharray[0] === 0});

        let currentDashLength = dasharray[0];
        for (let i = 1; i < dasharray.length; i++) {
            isDash = !isDash;

            const dashLength = dasharray[i];
            left = currentDashLength * stretch;
            currentDashLength += dashLength;
            right = currentDashLength * stretch;

            ranges.push({left, right, isDash, zeroLength: dashLength === 0});
        }

        return ranges;
    }

    addRoundDash(ranges: Object, stretch: number, n: number) {
        const halfStretch = stretch / 2;

        for (let y = -n; y <= n; y++) {
            const row = this.nextRow + n + y;
            const index = this.width * row;
            let currIndex = 0;
            let range = ranges[currIndex];

            for (let x = 0; x < this.width; x++) {
                if (x / range.right > 1) { range = ranges[++currIndex]; }

                const distLeft = Math.abs(x - range.left);
                const distRight = Math.abs(x - range.right);
                const minDist = Math.min(distLeft, distRight);
                let signedDistance;

                const distMiddle =  y / n * (halfStretch + 1);
                if (range.isDash) {
                    const distEdge = halfStretch - Math.abs(distMiddle);
                    signedDistance = Math.sqrt(minDist * minDist + distEdge * distEdge);
                } else {
                    signedDistance = halfStretch - Math.sqrt(minDist * minDist + distMiddle * distMiddle);
                }

                this.data[index + x] = Math.max(0, Math.min(255, signedDistance + 128));
            }
        }
    }

    addRegularDash(ranges: Object) {

        // Collapse any zero-length range
        // Collapse neighbouring same-type parts into a single part
        for (let i = ranges.length - 1; i >= 0; --i) {
            const part = ranges[i];
            const next = ranges[i + 1];
            if (part.zeroLength) {
                ranges.splice(i, 1);
            } else if (next && next.isDash === part.isDash) {
                next.left = part.left;
                ranges.splice(i, 1);
            }
        }

        // Combine the first and last parts if possible
        const first = ranges[0];
        const last = ranges[ranges.length - 1];
        if (first.isDash === last.isDash) {
            first.left = last.left - this.width;
            last.right = first.right + this.width;
        }

        const index = this.width * this.nextRow;
        let currIndex = 0;
        let range = ranges[currIndex];

        for (let x = 0; x < this.width; x++) {
            if (x / range.right > 1) {
                range = ranges[++currIndex];
            }

            const distLeft = Math.abs(x - range.left);
            const distRight = Math.abs(x - range.right);

            const minDist = Math.min(distLeft, distRight);
            const signedDistance = range.isDash ? minDist : -minDist;

            this.data[index + x] = Math.max(0, Math.min(255, signedDistance + 128));
        }
    }

    addDash(dasharray: Array<number>, round: boolean) {
        const n = round ? 7 : 0;
        const height = 2 * n + 1;

        if (this.nextRow + height > this.height) {
            warnOnce('LineAtlas out of space');
            return null;
        }

        let length = 0;
        for (let i = 0; i < dasharray.length; i++) { length += dasharray[i]; }

        if (length !== 0) {
            const stretch = this.width / length;
            const ranges = this.getDashRanges(dasharray, this.width, stretch);

            if (round) {
                this.addRoundDash(ranges, stretch, n);
            } else {
                this.addRegularDash(ranges);
            }
        }

        const dashEntry = {
            y: (this.nextRow + n + 0.5) / this.height,
            height: 2 * n / this.height,
            width: length
        };

        this.nextRow += height;
        this.dirty = true;

        return dashEntry;
    }

    bind(context: Context) {
        const gl = context.gl;
        if (!this.texture) {
            this.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, this.width, this.height, 0, gl.ALPHA, gl.UNSIGNED_BYTE, this.data);

        } else {
            gl.bindTexture(gl.TEXTURE_2D, this.texture);

            if (this.dirty) {
                this.dirty = false;
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.ALPHA, gl.UNSIGNED_BYTE, this.data);
            }
        }
    }
}

export default LineAtlas;
