// @flow
import { number } from "../style-spec/util/interpolate";
import Point  from "@mapbox/point-geometry";

/**
 * An `EdgeInset` object represents screen space padding applied to the edge map viewport
 * such that the vanishing point gets offset. This is useful for adding floating Ui elements
 * on top of the map and hainv the vanishing point shift as UI elements resize.
 *
 * @param {number} [top=0]
 * @param {number} [bottom=0]
 * @param {number} [left=0]
 * @param {number} [right=0]
 */
class EdgeInsets {
    top: number;
    bottom: number;
    left: number;
    right: number;

    constructor(top: number = 0, bottom: number = 0, left: number = 0, right: number = 0) {
        if (isNaN(top) || top < 0 ||
            isNaN(bottom) || bottom < 0 ||
            isNaN(left) || left < 0 ||
            isNaN(right) || right < 0
        ) {
            throw new Error('Invalid value for edge-insets, top, bottom, left and right must all be numbers');
        }

        this.top = top;
        this.bottom = bottom;
        this.left = left;
        this.right = right;
    }

    /**
     * Interpolates the inset in-placce.
     *
     * @param {EdgeInsetLike} target
     * @param {number} t
     * @returns {EdgeInsets}
     * @memberof EdgeInsets
     */
    interpolate(target: EdgeInsetLike, t: number): EdgeInsets {
        this.top = number(this.top, target.top, t);
        this.bottom = number(this.bottom, target.bottom, t);
        this.left = number(this.left, target.left, t);
        this.right = number(this.right, target.right, t);

        return this;
    }

    /**
     * Utility method for computing the vanishing point after applying insets.
     *
     * @param {number} width
     * @param {number} height
     * @returns {Point}
     * @memberof EdgeInsets
     */
    getCenter(width: number, height: number): Point {
        // Clamp insets so they never overflow width/height and always calculate a valid center
        const totalXInset = Math.min(this.left + this.right, width);
        const totalYInset = Math.min(this.top + this.bottom, height);

        const x = Math.min(this.left, width) + 0.5 * (width - totalXInset);
        const y = Math.min(this.top, height) + 0.5 * (height - totalYInset);

        return new Point(x, y);
    }

    equals(other: EdgeInsetLike): boolean {
        return this.top === other.top &&
            this.bottom === other.bottom &&
            this.left === other.left &&
            this.right === other.right;
    }
}

export type EdgeInsetLike = EdgeInsets | {top: number, bottom: number, right: number, left: number};

export default EdgeInsets;
