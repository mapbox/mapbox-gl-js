// @flow
import { number } from "../style-spec/util/interpolate";
import Point  from "@mapbox/point-geometry";

class EdgeInsets {
    top: number;
    bottom: number;
    left: number;
    right: number;

    constructor(top: number = 0, bottom: number = 0, left: number = 0, right: number = 0) {
        if (isNaN(top) ||
            isNaN(bottom) ||
            isNaN(left) ||
            isNaN(right)
        ) {
            throw new Error('Invalid value for edge-insets, top, bottom, left and right must all be numbers');
        }

        this.top = top;
        this.bottom = bottom;
        this.left = left;
        this.right = right;
    }

    interpolate(target: EdgeInsetLike, t: number): EdgeInsets {
        this.top = number(this.top, target.top, t);
        this.bottom = number(this.bottom, target.bottom, t);
        this.left = number(this.left, target.left, t);
        this.right = number(this.right, target.right, t);

        return this;
    }

    getCenter(width: number, height: number): Point {
        return new Point(
            this.left + 0.5 * (width - (this.left + this.right)),
            this.top + 0.5 * (height - (this.top + this.bottom)),
        );
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
