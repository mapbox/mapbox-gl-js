// @flow

export default class Anchor {
    x: number;
    y: number;
    angle: number;
    segment: ?number;

    constructor(x: number, y: number, angle: number, segment?: number) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.segment = segment;
    }
}
