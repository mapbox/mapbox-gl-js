import ONE_EM from './one_em';
import {getRasterizedIconSize, SIZE_PACK_FACTOR, type SizeData} from './symbol_size';
import {warnOnce} from '../util/util';

import type {TextJustify} from './shaping_shared';
import type {AppearanceLayoutProps} from '../style/appearance_properties';
import type {SymbolFeature} from '../data/bucket/symbol_bucket';
import type {CanonicalTileID} from '../source/tile_id';
import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import type SymbolAppearance from '../style/appearance';
import type ResolvedImage from '../style-spec/expression/types/resolved_image';
import type {ImageId} from '../style-spec/expression/types/image_id';
import type {ImageVariant} from '../style-spec/expression/types/image_variant';
import type {PossiblyEvaluatedPropertyValue, PropertyValue} from '../style/properties';

export type TextAnchor = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// The radial offset is to the edge of the text box
// In the horizontal direction, the edge of the text box is where glyphs start
// But in the vertical direction, the glyphs appear to "start" at the baseline
// We don't actually load baseline data, but we assume an offset of ONE_EM - 17
// (see "yOffset" in shaping.js)
const baselineOffset = 7;
const INVALID_TEXT_OFFSET = Number.POSITIVE_INFINITY;
const sqrt2 = Math.sqrt(2);

const MAX_GLYPH_ICON_SIZE = 255;
const MAX_PACKED_SIZE = MAX_GLYPH_ICON_SIZE * SIZE_PACK_FACTOR;
export {MAX_PACKED_SIZE};

export function evaluateVariableOffset(anchor: TextAnchor, [offsetX, offsetY]: [number, number]): [number, number] {
    let x = 0, y = 0;

    if (offsetY === INVALID_TEXT_OFFSET) { // radial offset
        if (offsetX < 0) offsetX = 0; // Ignore negative offset.
        // solve for r where r^2 + r^2 = offsetX^2
        const hypotenuse = offsetX / sqrt2;
        switch (anchor) {
        case 'top-right':
        case 'top-left':
            y = hypotenuse - baselineOffset;
            break;
        case 'bottom-right':
        case 'bottom-left':
            y = -hypotenuse + baselineOffset;
            break;
        case 'bottom':
            y = -offsetX + baselineOffset;
            break;
        case 'top':
            y = offsetX - baselineOffset;
            break;
        }

        switch (anchor) {
        case 'top-right':
        case 'bottom-right':
            x = -hypotenuse;
            break;
        case 'top-left':
        case 'bottom-left':
            x = hypotenuse;
            break;
        case 'left':
            x = offsetX;
            break;
        case 'right':
            x = -offsetX;
            break;
        }

    } else { // text offset
        // Use absolute offset values.
        offsetX = Math.abs(offsetX);
        offsetY = Math.abs(offsetY);

        switch (anchor) {
        case 'top-right':
        case 'top-left':
        case 'top':
            y = offsetY - baselineOffset;
            break;
        case 'bottom-right':
        case 'bottom-left':
        case 'bottom':
            y = -offsetY + baselineOffset;
            break;
        }

        switch (anchor) {
        case 'top-right':
        case 'bottom-right':
        case 'right':
            x = -offsetX;
            break;
        case 'top-left':
        case 'bottom-left':
        case 'left':
            x = offsetX;
            break;
        }
    }

    return [x, y];
}

// Resolve an appearance-overridable layout property. The `fallback` doubles as the expected
// runtime shape: a resolved value is accepted only if it matches the fallback (array vs number),
// otherwise the fallback is returned. `transform` is applied to accepted values only.
function getAppearanceLayoutValue<T extends number | [number, number]>(
    appearance: SymbolAppearance, symbolLayer: SymbolStyleLayer, feature: SymbolFeature, canonical: CanonicalTileID,
    prop: keyof AppearanceLayoutProps, fallback: T, transform?: (value: T) => T): T {
    const value = appearance.hasLayoutProperty(prop) ?
        symbolLayer.getAppearanceValueAndResolveTokens(appearance, prop, feature, canonical, []) :
        null;
    const accepted = Array.isArray(fallback) ? Array.isArray(value) : typeof value === typeof fallback;
    if (!accepted) return fallback;
    return transform ? transform(value as unknown as T) : value as unknown as T;
}

export function getAppearanceIconValues(appearance: SymbolAppearance, symbolLayer: SymbolStyleLayer, feature: SymbolFeature,
    canonical: CanonicalTileID, iconOffset: [number, number], baseIconRotate: number, layoutIconSize: number, iconScaleFactor: number) {
    const appearanceIconOffset = getAppearanceLayoutValue(appearance, symbolLayer, feature, canonical, 'icon-offset', iconOffset);
    const appearanceIconRotate = getAppearanceLayoutValue(appearance, symbolLayer, feature, canonical, 'icon-rotate', baseIconRotate);
    const appearanceIconSize = getAppearanceLayoutValue(appearance, symbolLayer, feature, canonical, 'icon-size', layoutIconSize, size => size * iconScaleFactor);
    return {appearanceIconOffset, appearanceIconRotate, appearanceIconSize};
}

export function getAppearanceTextValues(appearance: SymbolAppearance, symbolLayer: SymbolStyleLayer, feature: SymbolFeature,
    canonical: CanonicalTileID, textOffset: [number, number], baseTextRotate: number, layoutTextSize: number) {
    const appearanceTextOffset = getAppearanceLayoutValue(appearance, symbolLayer, feature, canonical, 'text-offset', textOffset, ([x, y]) => [x * ONE_EM, y * ONE_EM]);
    const appearanceTextRotate = getAppearanceLayoutValue(appearance, symbolLayer, feature, canonical, 'text-rotate', baseTextRotate);
    const appearanceTextSize = getAppearanceLayoutValue(appearance, symbolLayer, feature, canonical, 'text-size', layoutTextSize);
    return {appearanceTextOffset, appearanceTextRotate, appearanceTextSize};
}

function scaleImageVariant(image: ImageVariant | null, iconSizeData: SizeData, iconSize: PropertyValue<number, PossiblyEvaluatedPropertyValue<number>>, tileID: CanonicalTileID, zoom: number, feature: SymbolFeature, pixelRatio: number, iconScaleFactor: number, worldview: string | undefined, availableImages?: ImageId[]) {
    if (!image) return undefined;
    const iconSizeFactor = getRasterizedIconSize(iconSizeData, iconSize, tileID, zoom, feature, worldview, availableImages);
    const scaleFactor = iconSizeFactor * iconScaleFactor * pixelRatio;
    return image.scaleSelf(scaleFactor);
}

export function getScaledImageVariant(icon: ResolvedImage, iconSizeData: SizeData, iconSize: PropertyValue<number, PossiblyEvaluatedPropertyValue<number>>, tileID: CanonicalTileID, zoom: number, feature: SymbolFeature, pixelRatio: number, iconScaleFactor: number, worldview: string | undefined, availableImages?: ImageId[]) {
    const iconPrimary = scaleImageVariant(icon.getPrimary(), iconSizeData, iconSize, tileID, zoom, feature, pixelRatio, iconScaleFactor, worldview, availableImages);
    const iconSecondary = scaleImageVariant(icon.getSecondary(), iconSizeData, iconSize, tileID, zoom, feature, pixelRatio, iconScaleFactor, worldview, availableImages);
    return {iconPrimary, iconSecondary};
}

export function getAnchorJustification(anchor: TextAnchor): TextJustify {
    switch (anchor) {
    case 'right':
    case 'top-right':
    case 'bottom-right':
        return 'right';
    case 'left':
    case 'top-left':
    case 'bottom-left':
        return 'left';
    }
    return 'center';
}

export function computeFontScale(textSize: number, textScaleFactor: number) {
    const glyphSize = ONE_EM;
    const fontScale = textSize * textScaleFactor / glyphSize;
    return fontScale;
}

export function packSizeForVertex(layerId: string, sizeData: SizeData, evaluatedTextSize: number,
    scaleFactor: number, minZoomSize: number, maxZoomSize: number
) {
    let effectiveSizeData: number[] = null;

    if (sizeData.kind === 'source') {
        effectiveSizeData = [
            SIZE_PACK_FACTOR * evaluatedTextSize * scaleFactor
        ];
        if (effectiveSizeData[0] > MAX_PACKED_SIZE) {
            warnOnce(`${layerId}: Value for "text-size" or "icon-size" is >= ${MAX_GLYPH_ICON_SIZE}. Reduce your "text-size" or "icon-size".`);
        }
    } else if (sizeData.kind === 'composite') {
        effectiveSizeData = [
            SIZE_PACK_FACTOR * minZoomSize * scaleFactor,
            SIZE_PACK_FACTOR * maxZoomSize * scaleFactor
        ];
        if (effectiveSizeData[0] > MAX_PACKED_SIZE || effectiveSizeData[1] > MAX_PACKED_SIZE) {
            warnOnce(`${layerId}: Value for "text-size" or "icon-size" is >= ${MAX_GLYPH_ICON_SIZE}. Reduce your "text-size" or "icon-size".`);
        }
    }

    return effectiveSizeData;
}
