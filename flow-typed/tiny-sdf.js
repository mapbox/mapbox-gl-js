
declare module '@mapbox/tiny-sdf' {
    declare type TinySDFOptions = {
        fontSize?: number;
        buffer?: number;
        radius?: number;
        cutoff?: number;
        fontFamily?: string;
        fontWeight?: string;
        fontStyle?: string;
    };

    declare type TinySDFGlyph = {
        data: Uint8ClampedArray;
        width: number;
        height: number;
        glyphWidth: number;
        glyphHeight: number;
        glyphTop: number;
        glyphLeft: number;
        glyphAdvance: number;
    };

    declare class TinySDF {
        fontWeight: string;
        constructor(options: TinySDFOptions): TinySDF;
        draw(char: string): TinySDFGlyph;
    }

    declare export default Class<TinySDF>;
}
