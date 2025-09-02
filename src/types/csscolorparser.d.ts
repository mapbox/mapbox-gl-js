declare module 'csscolorparser' {
    /**
     * Parse CSS color string and return RGBA values
     * @param input - CSS color string (e.g., "#ff0000", "rgba(255,0,0,1)", "red")
     * @returns Array of [r, g, b, a] where r,g,b are 0-255 and a is 0-1, or null if invalid
     */
    export function parseCSSColor(input: string): [number, number, number, number] | null;
}
