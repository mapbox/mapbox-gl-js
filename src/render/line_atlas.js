// @flow

import {warnOnce, nextPowerOfTwo} from '../util/util.js';
import {AlphaImage} from '../util/image.js';
import {register} from '../util/web_worker_transfer.js';

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
    image: AlphaImage;
    positions: {[_: string]: any};
    uploaded: boolean;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.nextRow = 0;
        this.image = new AlphaImage({width, height});
        this.positions = {};
        this.uploaded = false;
    }

    /**
     * Get a dash line pattern.
     *
     * @param {Array<number>} dasharray
     * @param {string} lineCap the type of line caps to be added to dashes
     * @returns {Object} position of dash texture in { y, height, width }
     * @private
     */
    getDash(dasharray: Array<number>, lineCap: string) {
        const key = this.getKey(dasharray, lineCap);
        return this.positions[key];
    }

    trim() {
        const width = this.width;
        const height = this.height = nextPowerOfTwo(this.nextRow);
        this.image.resize({width, height});
    }

    getKey(dasharray: Array<number>, lineCap: string): string {
        return dasharray.join(',') + lineCap;
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

                this.image.data[index + x] = Math.max(0, Math.min(255, signedDistance + 128));
            }
        }
    }

    addRegularDash(ranges: Object, capLength: number) {

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
            const signedDistance = (range.isDash ? minDist : -minDist) + capLength;

            this.image.data[index + x] = Math.max(0, Math.min(255, signedDistance + 128));
        }
    }

    addDash(dasharray: Array<number>, lineCap: string) {
        const key = this.getKey(dasharray, lineCap);
        if (this.positions[key]) return this.positions[key];

        const round = lineCap === 'round';
        const n = round ? 7 : 0;
        const height = 2 * n + 1;

        if (this.nextRow + height > this.height) {
            warnOnce('LineAtlas out of space');
            return null;
        }

        // dasharray is empty, draws a full line (no dash or no gap length represented, default behavior)
        if (dasharray.length === 0) {
            // insert a single dash range in order to draw a full line
            dasharray.push(1);
        }

        let length = 0;
        for (let i = 0; i < dasharray.length; i++) {
            if (dasharray[i] < 0) {
                warnOnce('Negative value is found in line dasharray, replacing values with 0');
                dasharray[i] = 0;
            }
            length += dasharray[i];
        }

        if (length !== 0) {
            const stretch = this.width / length;
            const ranges = this.getDashRanges(dasharray, this.width, stretch);

            if (round) {
                this.addRoundDash(ranges, stretch, n);
            } else {
                const capLength = lineCap === 'square' ? 0.5 * stretch : 0;
                this.addRegularDash(ranges, capLength);
            }
        }

        const y = this.nextRow + n;

        this.nextRow += height;

        const pos = {
            tl: [y, n],
            br: [length, 0]
        };
        this.positions[key] = pos;
        return pos;
    }
}

register('LineAtlas', LineAtlas);

export default LineAtlas;
