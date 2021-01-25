// @flow

import type {AlphaImage} from '../util/image';

export type GlyphMetrics = {
    width: number,
    height: number,
    left: number,
    top: number,
    advance: number,
    localGlyph?: boolean
};

export type StyleGlyph = {
    id: number,
    bitmap: AlphaImage,
    metrics: GlyphMetrics
};
