// @flow

import { color } from 'd3-color';

/**
 * An RGBA color value. Create instances from color strings using the static
 * method `Color.parse`. The constructor accepts RGB channel values in the range
 * `[0, 1]`, premultiplied by A.
 *
 * @param {number} r The red channel.
 * @param {number} g The green channel.
 * @param {number} b The blue channel.
 * @param {number} a The alpha channel.
 * @private
 */
class Color {
    r: number;
    g: number;
    b: number;
    a: number;

    constructor(r: number, g: number, b: number, a: number = 1) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    static black: Color;
    static white: Color;
    static transparent: Color;

    /**
     * Parses valid CSS color strings and returns a `Color` instance.
     * @returns A `Color` instance, or `undefined` if the input is not a valid color string.
     */
    static parse(input: ?string): Color | void {
        if (!input) {
            return undefined;
        }

        if (input instanceof Color) {
            return input;
        }

        if (typeof input !== 'string') {
            return undefined;
        }

        const c = color(input);
        if (!c) {
            return undefined;
        }

        const {r, g, b, opacity} = c.rgb();
        return new Color(
            (r || 0) / 255 * opacity,
            (g || 0) / 255 * opacity,
            (b || 0) / 255 * opacity,
            (opacity || 0)
        );
    }

    /**
     * Returns an RGBA string representing the color value.
     *
     * @returns An RGBA string.
     * @example
     * var purple = new Color.parse('purple');
     * purple.toString; // = "rgba(128,0,128,1)"
     * var translucentGreen = new Color.parse('rgba(26, 207, 26, .73)');
     * translucentGreen.toString(); // = "rgba(26,207,26,0.73)"
     */
    toString(): string {
        const [r, g, b, a] = this.toArray();
        return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
    }

    toArray(): [number, number, number, number] {
        const {r, g, b, a} = this;
        return a === 0 ? [0, 0, 0, 0] : [
            r * 255 / a,
            g * 255 / a,
            b * 255 / a,
            a
        ];
    }
}

Color.black = new Color(0, 0, 0, 1);
Color.white = new Color(1, 1, 1, 1);
Color.transparent = new Color(0, 0, 0, 0);

export default Color;
