// @flow

import type {AlphaImage} from '../util/image.js';

export type GlyphMetrics = {
    width: number,
    height: number,
    left: number,
    top: number,
    advance: number,
    localGlyph?: boolean,
    ascender: number,
    descender: number
};

export type StyleGlyph = {
    id: number,
    bitmap: AlphaImage,
    metrics: GlyphMetrics
};
