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

    constructor(r: number, g: number, b: number, a: number = 1) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
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
    static parse(input?: string | Color | null): Color | void {
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

        return new Color(
            rgba[0] / 255 * rgba[3],
            rgba[1] / 255 * rgba[3],
            rgba[2] / 255 * rgba[3],
            rgba[3]
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

    /**
     * Returns an RGBA array of values representing the color, unpremultiplied by A.
     *
     * @returns An array of RGBA color values in the range [0, 255].
     */
    toArray(): [number, number, number, number] {
        const {r, g, b, a} = this;
        return a === 0 ? [0, 0, 0, 0] : [
            r * 255 / a,
            g * 255 / a,
            b * 255 / a,
            a
        ];
    }

    /**
     * Returns a RGBA array of float values representing the color, unpremultiplied by A.
     *
     * @returns An array of RGBA color values in the range [0, 1].
     */
    toArray01(): [number, number, number, number] {
        const {r, g, b, a} = this;
        return a === 0 ? [0, 0, 0, 0] : [
            r / a,
            g / a,
            b / a,
            a
        ];
    }

    /**
     * Returns an RGB array of values representing the color, unpremultiplied by A and multiplied by a scalar.
     *
     * @param {number} scale A scale to apply to the unpremultiplied-alpha values.
     * @returns An array of RGB color values in the range [0, 1].
     */
    toArray01Scaled(scale: number): [number, number, number] {
        const {r, g, b, a} = this;
        return a === 0 ? [0, 0, 0] : [
            (r / a) * scale,
            (g / a) * scale,
            (b / a) * scale
        ];
    }

    /**
     * Returns an RGBA array of values representing the color, premultiplied by A.
     *
     * @returns An array of RGBA color values in the range [0, 1].
     */
    toArray01PremultipliedAlpha(): [number, number, number, number] {
        const {r, g, b, a} = this;
        return [
            r,
            g,
            b,
            a
        ];
    }

    /**
     * Returns an RGBA array of values representing the color, unpremultiplied by A, and converted to linear color space.
     * The color is defined by sRGB primaries, but the sRGB transfer function is reversed to obtain linear energy.
     *
     * @returns An array of RGBA color values in the range [0, 1].
     */
    toArray01Linear(): [number, number, number, number] {
        const {r, g, b, a} = this;
        return a === 0 ? [0, 0, 0, 0] : [
            Math.pow((r / a), 2.2),
            Math.pow((g / a), 2.2),
            Math.pow((b / a), 2.2),
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
