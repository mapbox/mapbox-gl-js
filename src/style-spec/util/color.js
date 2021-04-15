// @flow

import {parseCSSColor} from 'csscolorparser';

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
    premultiplyAlpha: boolean;

    constructor(r: number, g: number, b: number, a: number = 1, premultiplyAlpha: boolean = true) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
        this.premultiplyAlpha = premultiplyAlpha;
    }

    static black: Color;
    static white: Color;
    static transparent: Color;
    static red: Color;
    static blue: Color;

    /**
     * Parses valid CSS color strings and returns a `Color` instance.
     * @returns A `Color` instance, or `undefined` if the input is not a valid color string.
     */
    static parse(input?: string | Color | null, premultiplyAlpha?: boolean = true): Color | void {
        if (!input) {
            return undefined;
        }

        if (input instanceof Color) {
            return input;
        }

        if (typeof input !== 'string') {
            return undefined;
        }

        const rgba = parseCSSColor(input);
        if (!rgba) {
            return undefined;
        }

        const factor = premultiplyAlpha ? rgba[3] : 1;

        return new Color(
            rgba[0] / 255 * factor,
            rgba[1] / 255 * factor,
            rgba[2] / 255 * factor,
            rgba[3],
            premultiplyAlpha
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
        const {r, g, b, a, premultiplyAlpha} = this;
        if (premultiplyAlpha && a === 0) return [0, 0, 0, 0];
        const factor = premultiplyAlpha ? 1 / a : 1;
        return [
            r * 255 * factor,
            g * 255 * factor,
            b * 255 * factor,
            a
        ];
    }
}

Color.black = new Color(0, 0, 0, 1);
Color.white = new Color(1, 1, 1, 1);
Color.transparent = new Color(0, 0, 0, 0);
Color.red = new Color(1, 0, 0, 1);
Color.blue = new Color(0, 0, 1, 1);

export default Color;
