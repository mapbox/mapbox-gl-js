import TinySDF from '@mapbox/tiny-sdf';
import isChar from '../util/is_char_in_unicode_block';
import {AlphaImage} from '../util/image';

import type {Class} from '../types/class';
import type {StyleGlyph} from '../style/style_glyph';

/*
  SDF_SCALE controls the pixel density of locally generated glyphs relative
  to "normal" SDFs which are generated at 24pt font and a "pixel ratio" of 1.
  The GlyphManager will generate glyphs SDF_SCALE times as large,
  but with the same glyph metrics, and the quad generation code will scale them
  back down so they display at the same size.

  The choice of SDF_SCALE is a trade-off between performance and quality.
  Glyph generation time grows quadratically with the the scale, while quality
  improvements drop off rapidly when the scale is higher than the pixel ratio
  of the device. The scale of 2 buys noticeable improvements on HDPI screens
  at acceptable cost.

  The scale can be any value, but in order to avoid small distortions, these
  pixel-based values must come out to integers:
   - "localGlyphPadding" in GlyphAtlas
   - Font/Canvas/Buffer size for TinySDF
  localGlyphPadding + buffer should equal 4 * SDF_SCALE. So if you wanted to
  use an SDF_SCALE of 1.75, you could manually set localGlyphAdding to 2 and
  buffer to 5.
*/
export const SDF_SCALE = 2;

const BOLD_FONT_RE = /bold/i;
const MEDIUM_FONT_RE = /medium/i;
const LIGHT_FONT_RE = /light/i;

// Only these four font weights are supported
type FontWeight = '200' | '400' | '500' | '900';

export const LocalGlyphMode = {
    none: 0,
    ideographs: 1,
    all: 2
} as const;

export type LocalGlyphConfig = {
    mode: number;
    fontFamily?: string;
};

function getFontWeight(stack: string): FontWeight {
    if (BOLD_FONT_RE.test(stack)) return '900';
    if (MEDIUM_FONT_RE.test(stack)) return '500';
    if (LIGHT_FONT_RE.test(stack)) return '200';
    return '400';
}

/**
 * Rasterizes glyphs locally with TinySDF, used on the main thread by GlyphManager and in workers
 * when they can rasterize with `OffscreenCanvas` themselves.
 * @private
 */
export class LocalGlyphRasterizer {
    mode: number;
    fontFamily?: string;
    // Multiple fontstacks may share the same local glyphs, so index them by font weight only
    tinySDFs: Partial<Record<FontWeight, TinySDF>>;
    glyphs: Record<FontWeight, Record<number, StyleGlyph>>;

    static TinySDF: Class<TinySDF> = TinySDF;

    constructor({mode, fontFamily}: LocalGlyphConfig) {
        this.mode = mode;
        this.fontFamily = fontFamily;
        this.tinySDFs = {};
        this.glyphs = {'200': {}, '400': {}, '500': {}, '900': {}};
    }

    supports(id: number): boolean {
        if (!this.fontFamily) {
            return false;
        } else if (this.mode === LocalGlyphMode.all) {
            return true;
        } else {
            /* eslint-disable new-cap */
            return (
                (isChar['CJK Unified Ideographs'](id) ||
                isChar['Hangul Syllables'](id) ||
                isChar['Hiragana'](id) ||
                isChar['Katakana'](id) ||
                // gl-native parity: Extend Ideographs rasterization range to include CJK symbols and punctuations
                isChar['CJK Symbols and Punctuation'](id) ||
                isChar['CJK Unified Ideographs Extension A'](id) || isChar['CJK Unified Ideographs Extension B'](id)) || // very rare surrogate characters
                isChar['Osage'](id)
            );
            /* eslint-enable new-cap */
        }
    }

    draw(stack: string, id: number): StyleGlyph | undefined {
        if (!this.supports(id)) return;

        const fontWeight = getFontWeight(stack);
        const cached = this.glyphs[fontWeight][id];
        if (cached) return cached;

        let tinySDF = this.tinySDFs[fontWeight];
        if (!tinySDF) {
            const fontSize = 24 * SDF_SCALE;
            const buffer = 3 * SDF_SCALE;
            const radius = 8 * SDF_SCALE;
            tinySDF = this.tinySDFs[fontWeight] = new LocalGlyphRasterizer.TinySDF({fontFamily: this.fontFamily, fontWeight, fontSize, buffer, radius});
        }

        const char = String.fromCodePoint(id);
        const {data, width, height, glyphWidth, glyphHeight, glyphLeft, glyphTop, glyphAdvance} = tinySDF.draw(char);
        /*
        TinySDF's "top" is the distance from the alphabetic baseline to the
         top of the glyph.

        Server-generated fonts specify "top" relative to an origin above the
         em box (the origin comes from FreeType, but I'm unclear on exactly
         how it's derived)
          ref: https://github.com/mapbox/sdf-glyph-foundry

        Server fonts don't yet include baseline information, so we can't line
        up exactly with them (and they don't line up with each other)
          ref: https://github.com/mapbox/node-fontnik/pull/160

        To approximately align TinySDF glyphs with server-provided glyphs, we
        use this baseline adjustment factor calibrated to be in between DIN Pro
        and Arial Unicode (but closer to Arial Unicode)
        */
        const baselineAdjustment = 27;

        const glyph = this.glyphs[fontWeight][id] = {
            id,
            bitmap: new AlphaImage({width, height}, data),
            metrics: {
                width: glyphWidth / SDF_SCALE,
                height: glyphHeight / SDF_SCALE,
                left: glyphLeft / SDF_SCALE,
                top: glyphTop / SDF_SCALE - baselineAdjustment,
                advance: glyphAdvance / SDF_SCALE,
                localGlyph: true
            }
        };
        return glyph;
    }
}

// Fonts added with CSS @font-face or `document.fonts` are not visible to workers
export function isDocumentFont(fontFamily: string): boolean {
    if (typeof document === 'undefined' || !document.fonts) return false;
    const unquote = (family: string) => family.trim().replace(/^["']|["']$/g, '').toLowerCase();
    const families = fontFamily.split(',').map(unquote);
    let found = false;
    document.fonts.forEach((face) => {
        if (families.includes(unquote(face.family))) found = true;
    });
    return found;
}
