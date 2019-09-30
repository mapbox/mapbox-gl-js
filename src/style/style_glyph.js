// @flow

import type {AlphaImage} from '../util/image.js';

export type GlyphMetrics = {
    width: number,
    height: number,
    left: number,
    top: number,
<<<<<<< HEAD
    advance: number,
    localGlyph?: boolean
    ascender: number,
    descender: number
=======
    advance: number
>>>>>>> Move ascender/descender to font level attributes, remove non-necessary pbf files
};

export type StyleGlyph = {
    id: number,
    bitmap: AlphaImage,
    metrics: GlyphMetrics
};
