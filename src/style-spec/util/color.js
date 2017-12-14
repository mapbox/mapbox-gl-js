// @flow

const {parseCSSColor} = require('csscolorparser');

/**
 * An RGBA color value. Create instances from color strings using the static
 * method `Color.parse`. The constructor accepts RGB channel values in the range
 * `[0, 1]`, premultiplied by A.
 *
 * @param {number} r The red channel.
 * @param {number} g The green channel.
 * @param {number} b The blue channel.
 * @param {number} a The alpha channel.
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
        const transformRgb = (value: number) => Math.round(value * 255 / this.a);
        const rgb = [this.r, this.g, this.b].map(transformRgb);
        return `rgba(${rgb.concat(this.a).join(',')})`;
    }
}

Color.black = new Color(0, 0, 0, 1);
Color.white = new Color(1, 1, 1, 1);
Color.transparent = new Color(0, 0, 0, 0);

module.exports = Color;
