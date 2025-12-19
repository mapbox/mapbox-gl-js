import Anchor from './anchor';
import {getAnchors, getCenterAnchor} from './get_anchors';
import {shapeText, shapeIcon, WritingMode, fitIconToText, isPositionedIcon, getPositionedIconSize, isFullyStretchableX, isFullyStretchableY} from './shaping';
import {getGlyphQuads, getIconQuads, getIconQuadsNumber, type SymbolQuad} from './quads';
import {warnOnce, degToRad, clamp} from '../util/util';
import {
    allowsVerticalWritingMode,
    allowsLetterSpacing
} from '../util/script_detection';
import findPoleOfInaccessibility from '../util/find_pole_of_inaccessibility';
import classifyRings from '../util/classify_rings';
import EXTENT from '../style-spec/data/extent';
import EvaluationParameters from '../style/evaluation_parameters';
import {getRasterizedIconSize, getSizeData, SIZE_PACK_FACTOR, type SizeData} from './symbol_size';
import ONE_EM from './one_em';
import Point from '@mapbox/point-geometry';
import murmur3 from 'murmurhash-js';
import {PROPERTY_ELEVATION_ID} from '../../3d-style/elevation/elevation_constants';
import {clipLines} from '../util/line_clipping';
import {keys} from '../util/object';
import {getImagePosition, ICON_PADDING, type ImagePositionMap, type ImagePosition} from '../render/image_atlas';

import type {SymbolFeature} from '../data/bucket/symbol_bucket';
import type SymbolBucket from '../data/bucket/symbol_bucket';
import type {CanonicalTileID} from '../source/tile_id';
import type {Shaping, PositionedIcon, TextJustify, SymbolAnchor} from './shaping';
import type {GlyphMap} from '../render/glyph_manager';
import type {CollisionBoxArray} from '../data/array_types';
import type {StyleImage, StyleImageMap} from '../style/style_image';
import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import type {GlyphPositions} from '../render/glyph_atlas';
import type {PossiblyEvaluated, PossiblyEvaluatedPropertyValue, PropertyValue} from '../style/properties';
import type Projection from '../geo/projection/projection';
import type {vec3} from 'gl-matrix';
import type {LayoutProps} from '../style/style_layer/symbol_style_layer_properties';
import type ImageAtlas from '../render/image_atlas';
import type ResolvedImage from '../style-spec/expression/types/resolved_image';
import type {ImageId} from '../style-spec/expression/types/image_id';
import type {ImageVariant, StringifiedImageVariant} from '../style-spec/expression/types/image_variant';
import type {ImageRasterizationTasks} from '../render/image_manager';
import type SymbolAppearance from '../style/appearance';

// The symbol layout process needs `text-size` evaluated at up to five different zoom levels, and
// `icon-size` at up to three:
//
//   1. `text-size` at the zoom level of the bucket. Used to calculate a per-feature size for source `text-size`
//       expressions, and to calculate the box dimensions for icon-text-fit.
//   2. `icon-size` at the zoom level of the bucket. Used to calculate a per-feature size for source `icon-size`
//       expressions.
//   3. `text-size` and `icon-size` at the zoom level of the bucket, plus one. Used to calculate collision boxes.
//   4. `text-size` at zoom level 18. Used for something line-symbol-placement-related.
//   5.  For composite `*-size` expressions: two zoom levels of curve stops that "cover" the zoom level of the
//       bucket. These go into a vertex buffer and are used by the shader to interpolate the size at render time.
//
// (1) and (2) are stored in `bucket.layers[0].layout`. The remainder are below.
//
export type Sizes = {
    scaleFactor: number,
    textScaleFactor: number
    iconScaleFactor: number
    textSizeScaleRange: [number, number]
    iconSizeScaleRange: [number, number]
    layoutTextSize: PossiblyEvaluatedPropertyValue<number> // (3);
    layoutIconSize: PossiblyEvaluatedPropertyValue<number> // (3);
    textMaxSize: PossiblyEvaluatedPropertyValue<number>    // (4);
    compositeTextSizes: [PossiblyEvaluatedPropertyValue<number>, PossiblyEvaluatedPropertyValue<number>] // (5);
    compositeIconSizes: [PossiblyEvaluatedPropertyValue<number>, PossiblyEvaluatedPropertyValue<number>] // (5);
};

export type TextAnchor = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// The radial offset is to the edge of the text box
// In the horizontal direction, the edge of the text box is where glyphs start
// But in the vertical direction, the glyphs appear to "start" at the baseline
// We don't actually load baseline data, but we assume an offset of ONE_EM - 17
// (see "yOffset" in shaping.js)
const baselineOffset = 7;
const INVALID_TEXT_OFFSET = Number.POSITIVE_INFINITY;
const sqrt2 = Math.sqrt(2);

export const SymbolBucketConstants = {
    // this constant is based on the size of StructArray indexes used in a symbol
    // bucket--namely, glyphOffsetArrayStart
    // eg the max valid UInt16 is 65,535
    // See https://github.com/mapbox/mapbox-gl-js/issues/2907 for motivation
    // lineStartIndex and textBoxStartIndex could potentially be concerns
    // but we expect there to be many fewer boxes/lines than glyphs
    MAX_GLYPHS: 65535
} as const;

/**
 * Represents a bounding box for symbols that can cover all the symbol variants
 * in either layout or appearances. Used for collision detection calculations.
 */
export type SymbolBoundingBox = {
    top: number;
    bottom: number;
    left: number;
    right: number;
    scaled: boolean;
};

/**
 * Scale a SymbolBoundingBox by the given factor
 */
function scaleBoundingBox(bbox: SymbolBoundingBox, scale: number): void {
    bbox.top *= scale;
    bbox.bottom *= scale;
    bbox.left *= scale;
    bbox.right *= scale;
    bbox.scaled = true;
}

/**
 * Rotate a SymbolBoundingBox by the given angle in degrees
 */
function rotateBoundingBox(bbox: SymbolBoundingBox, rotateDegrees: number): void {
    if (!rotateDegrees) return;

    const rotateRadians = degToRad(rotateDegrees);

    // Create the four corners of the bounding box
    const tl = new Point(bbox.left, bbox.top);
    const tr = new Point(bbox.right, bbox.top);
    const bl = new Point(bbox.left, bbox.bottom);
    const br = new Point(bbox.right, bbox.bottom);

    const center = new Point(0, 0);
    tl._rotateAround(rotateRadians, center);
    tr._rotateAround(rotateRadians, center);
    bl._rotateAround(rotateRadians, center);
    br._rotateAround(rotateRadians, center);

    // Take the envelope of the rotated geometry
    bbox.left = Math.min(tl.x, tr.x, bl.x, br.x);
    bbox.right = Math.max(tl.x, tr.x, bl.x, br.x);
    bbox.top = Math.min(tl.y, tr.y, bl.y, br.y);
    bbox.bottom = Math.max(tl.y, tr.y, bl.y, br.y);
}

/**
 * Updates an icon bounding box by calculating the bounds from a positioned icon,
 * applying transformations, and merging with the existing bounding box.
 */
function getUpdateSymbolBoundingBox(
    shaped: PositionedIcon | Shaping,
    existingBBox: SymbolBoundingBox | null | undefined,
    rotate: number,
    scale?: number,
    textOffset?: [number, number]
): SymbolBoundingBox {
    // Extract collision padding if available (only for PositionedIcon)
    const collisionPadding = isPositionedIcon(shaped) && shaped.collisionPadding ? shaped.collisionPadding : [0, 0, 0, 0];

    // Calculate bounding box from shaped icon or text
    const top = shaped.top - collisionPadding[1];
    const bottom = shaped.bottom + collisionPadding[3];
    const left = shaped.left - collisionPadding[0];
    const right = shaped.right + collisionPadding[2];

    const newBBox: SymbolBoundingBox = {
        top,
        bottom,
        left,
        right,
        scaled: false
    };

    if (scale !== undefined) {
        scaleBoundingBox(newBBox, scale);
    }

    if (rotate) {
        rotateBoundingBox(newBBox, rotate);
    }

    if (textOffset) {
        newBBox.left += textOffset[0];
        newBBox.right += textOffset[0];
        newBBox.top += textOffset[1];
        newBBox.bottom += textOffset[1];
    }

    // Merge with existing bounding box or return the new one
    if (!existingBBox) {
        return newBBox;
    } else {
        return {
            top: Math.min(existingBBox.top, newBBox.top),
            bottom: Math.max(existingBBox.bottom, newBBox.bottom),
            left: Math.min(existingBBox.left, newBBox.left),
            right: Math.max(existingBBox.right, newBBox.right),
            scaled: existingBBox.scaled || newBBox.scaled
        };
    }
}

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

type ShapedTextOrientations = {horizontal: Partial<Record<PlacementTypes, Shaping>>, vertical?: Shaping};
export type SymbolFeatureData = {
    feature: SymbolFeature,
    shapedTextOrientations: ShapedTextOrientations,
    shapedText: Shaping,
    shapedIcon: PositionedIcon,
    iconPrimary: ImageVariant,
    iconSecondary: ImageVariant,
    verticallyShapedIcon: PositionedIcon,
    layoutTextSize: number,
    layoutIconSize: number,
    textOffset: [number, number],
    isSDFIcon: boolean,
    iconTextFit: "none" | "width" | "height" | "both",
    iconOffset: [number, number],
    iconCollisionBounds?: SymbolBoundingBox | null,
    iconVerticalCollisionBounds?: SymbolBoundingBox | null,
    textCollisionBounds?: SymbolBoundingBox | null,
    textVerticalCollisionBounds?: SymbolBoundingBox | null
};

export type SymbolBucketData = {
    featureData: SymbolFeatureData[],
    sizes: Sizes,
    hasAnySecondaryIcon: boolean,
    textAlongLine: boolean,
    symbolPlacement: "point" | "line" | "line-center"
};

export function performSymbolLayout(bucket: SymbolBucket,
                             glyphMap: GlyphMap,
                             glyphPositions: GlyphPositions,
                             imageMap: StyleImageMap<StringifiedImageVariant>,
                             imagePositions: ImagePositionMap,
                             canonical: CanonicalTileID,
                             tileZoom: number,
                             scaleFactor: number = 1,
                             pixelRatio: number,
                             imageRasterizationTasks: ImageRasterizationTasks,
                             worldview: string | undefined,
                             availableImages?: ImageId[]): SymbolBucketData {
    bucket.createArrays();

    const tileSize = 512 * bucket.overscaling;
    bucket.tilePixelRatio = EXTENT / tileSize;
    bucket.compareText = {};
    bucket.iconsNeedLinear = false;

    const layout = bucket.layers[0].layout;
    const unevaluatedLayoutValues = bucket.layers[0]._unevaluatedLayout._values;

    const sizes = {} as Sizes;

    sizes.scaleFactor = scaleFactor;
    sizes.textSizeScaleRange = layout.get('text-size-scale-range');
    sizes.iconSizeScaleRange = layout.get('icon-size-scale-range');
    const [textSizeScaleRangeMin, textSizeScaleRangeMax] = sizes.textSizeScaleRange;
    const [iconSizeScaleRangeMin, iconSizeScaleRangeMax] = sizes.iconSizeScaleRange;
    sizes.textScaleFactor = clamp(sizes.scaleFactor, textSizeScaleRangeMin, textSizeScaleRangeMax);
    sizes.iconScaleFactor = clamp(sizes.scaleFactor, iconSizeScaleRangeMin, iconSizeScaleRangeMax);
    const unevaluatedTextSize = unevaluatedLayoutValues['text-size'];
    const unevaluatedIconSize = unevaluatedLayoutValues['icon-size'];

    if (bucket.textSizeData.kind === 'composite') {
        const {minZoom, maxZoom} = bucket.textSizeData;
        sizes.compositeTextSizes = [
            unevaluatedTextSize.possiblyEvaluate(new EvaluationParameters(minZoom, {worldview}), canonical),
            unevaluatedTextSize.possiblyEvaluate(new EvaluationParameters(maxZoom, {worldview}), canonical)
        ];
    }

    if (bucket.iconSizeData.kind === 'composite') {
        const {minZoom, maxZoom} = bucket.iconSizeData;
        sizes.compositeIconSizes = [
            unevaluatedIconSize.possiblyEvaluate(new EvaluationParameters(minZoom, {worldview}), canonical, availableImages),
            unevaluatedIconSize.possiblyEvaluate(new EvaluationParameters(maxZoom, {worldview}), canonical, availableImages)
        ];
    }

    sizes.layoutTextSize = unevaluatedTextSize.possiblyEvaluate(new EvaluationParameters(tileZoom + 1, {worldview}), canonical);
    sizes.layoutIconSize = unevaluatedIconSize.possiblyEvaluate(new EvaluationParameters(tileZoom + 1, {worldview}), canonical, availableImages);
    sizes.textMaxSize = unevaluatedTextSize.possiblyEvaluate(new EvaluationParameters(18, {worldview}), canonical);

    const symbolPlacement = layout.get('symbol-placement');
    const textAlongLine = layout.get('text-rotation-alignment') === 'map' && symbolPlacement !== 'point';
    const textSize = layout.get('text-size');

    let hasAnySecondaryIcon = false;
    const featureData = [];

    for (const feature of bucket.features) {

        const fontstack = layout.get('text-font').evaluate(feature, {}, canonical).join(',');

        const layoutTextSizeThisZoom = textSize.evaluate(feature, {}, canonical) * sizes.textScaleFactor;
        const layoutTextSize = sizes.layoutTextSize.evaluate(feature, {}, canonical) * sizes.textScaleFactor;
        const layoutIconSize = sizes.layoutIconSize.evaluate(feature, {}, canonical, availableImages) * sizes.iconScaleFactor;

        const shapedTextOrientations: ShapedTextOrientations = {
            horizontal: {},
            vertical: undefined
        };
        const text = feature.text;
        let textOffset: [number, number] = [0, 0];
        if (text) {
            const unformattedText = text.toString();

            const spacing = layout.get('text-letter-spacing').evaluate(feature, {}, canonical) * ONE_EM;

            const lineHeight = layout.get('text-line-height').evaluate(feature, {}, canonical) * ONE_EM;
            const spacingIfAllowed = allowsLetterSpacing(unformattedText) ? spacing : 0;

            const textAnchor = layout.get('text-anchor').evaluate(feature, {}, canonical);
            const variableTextAnchor = layout.get('text-variable-anchor');

            if (!variableTextAnchor) {
                const radialOffset = layout.get('text-radial-offset').evaluate(feature, {}, canonical);
                // Layers with variable anchors use the `text-radial-offset` property and the [x, y] offset vector
                // is calculated at placement time instead of layout time
                if (radialOffset) {
                    // The style spec says don't use `text-offset` and `text-radial-offset` together
                    // but doesn't actually specify what happens if you use both. We go with the radial offset.
                    textOffset = evaluateVariableOffset(textAnchor, [radialOffset * ONE_EM, INVALID_TEXT_OFFSET]);
                } else {
                    const evaluatedTextOffset = layout.get('text-offset').evaluate(feature, {}, canonical);
                    textOffset = [evaluatedTextOffset[0] * ONE_EM, evaluatedTextOffset[1] * ONE_EM];
                }
            }

            let textJustify = textAlongLine ?
                "center" :
                layout.get('text-justify').evaluate(feature, {}, canonical);

            const isPointPlacement = symbolPlacement === 'point';
            const maxWidth = isPointPlacement ?
                layout.get('text-max-width').evaluate(feature, {}, canonical) * ONE_EM :
                Infinity;

            const addVerticalShapingIfNeeded = (textJustify: TextJustify) => {
                if (bucket.allowVerticalPlacement && allowsVerticalWritingMode(unformattedText)) {
                    // Vertical POI label placement is meant to be used for scripts that support vertical
                    // writing mode, thus, default left justification is used. If Latin
                    // scripts would need to be supported, this should take into account other justifications.
                    shapedTextOrientations.vertical = shapeText(text, glyphMap, glyphPositions, imagePositions, fontstack, maxWidth, lineHeight, textAnchor,
                                                                textJustify, spacingIfAllowed, textOffset, WritingMode.vertical, true, layoutTextSize, layoutTextSizeThisZoom, pixelRatio);
                }
            };

            // If this layer uses text-variable-anchor, generate shapings for all justification possibilities.
            if (!textAlongLine && variableTextAnchor) {
                const justifications = textJustify === "auto" ?

                    variableTextAnchor.map(a => getAnchorJustification(a)) :
                    [textJustify];

                let singleLine = false;
                for (let i = 0; i < justifications.length; i++) {
                    const justification: TextJustify = justifications[i];
                    if (shapedTextOrientations.horizontal[justification]) continue;
                    if (singleLine) {
                        // If the shaping for the first justification was only a single line, we
                        // can re-use it for the other justifications
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        shapedTextOrientations.horizontal[justification] = shapedTextOrientations.horizontal[0];
                    } else {
                        // If using text-variable-anchor for the layer, we use a center anchor for all shapings and apply
                        // the offsets for the anchor in the placement step.
                        const shaping = shapeText(text, glyphMap, glyphPositions, imagePositions, fontstack, maxWidth, lineHeight, 'center',
                                                  justification, spacingIfAllowed, textOffset, WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom, pixelRatio);
                        if (shaping) {
                            shapedTextOrientations.horizontal[justification] = shaping;
                            singleLine = shaping.positionedLines.length === 1;
                        }
                    }
                }

                addVerticalShapingIfNeeded('left');
            } else {
                if (textJustify === "auto") {
                    textJustify = getAnchorJustification(textAnchor);
                }
                // Add horizontal shaping for all point labels and line labels that need horizontal writing mode.

                if (isPointPlacement || ((layout.get("text-writing-mode").indexOf('horizontal') >= 0) || !allowsVerticalWritingMode(unformattedText))) {
                    const shaping = shapeText(text, glyphMap, glyphPositions, imagePositions, fontstack, maxWidth, lineHeight, textAnchor, textJustify, spacingIfAllowed,
                                            textOffset, WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom, pixelRatio);
                    if (shaping) shapedTextOrientations.horizontal[textJustify] = shaping;
                }

                // Vertical point label (if allowVerticalPlacement is enabled).
                addVerticalShapingIfNeeded(isPointPlacement ? 'left' : textJustify);
            }
        }

        let shapedIcon: PositionedIcon;
        let isSDFIcon = false;
        let iconPrimary: ImageVariant;
        let primaryImage: StyleImage;
        let iconSecondary: ImageVariant;
        let secondaryImage: StyleImage;
        let iconOffset: [number, number];
        let iconAnchor: SymbolAnchor;
        const iconTextFit = layout.get('icon-text-fit').evaluate(feature, {}, canonical);
        if (feature.icon && feature.icon.hasPrimary()) {
            const icons = getScaledImageVariant(feature.icon, bucket.iconSizeData, unevaluatedLayoutValues['icon-size'], canonical, bucket.zoom, feature, pixelRatio, sizes.iconScaleFactor, worldview, availableImages);
            iconPrimary = icons.iconPrimary;
            iconSecondary = icons.iconSecondary;
            const primaryImageSerialized = iconPrimary.toString();
            primaryImage = imageMap.get(primaryImageSerialized);
            if (primaryImage) {
                iconOffset = layout.get('icon-offset').evaluate(feature, {}, canonical);
                iconAnchor = layout.get('icon-anchor').evaluate(feature, {}, canonical);
                shapedIcon = shapeIcon(
                    imagePositions.get(primaryImageSerialized),
                    iconSecondary ? imagePositions.get(iconSecondary.toString()) : undefined,
                    iconOffset,
                    iconAnchor
                );
                isSDFIcon = primaryImage.sdf;
                if (bucket.sdfIcons === undefined) {
                    bucket.sdfIcons = primaryImage.sdf;
                } else if (bucket.sdfIcons !== primaryImage.sdf) {
                    warnOnce('Style sheet warning: Cannot mix SDF and non-SDF icons in one buffer');
                }
                if (primaryImage.pixelRatio !== bucket.pixelRatio) {
                    bucket.iconsNeedLinear = true;

                } else if (layout.get('icon-rotate').constantOr(1) !== 0) {
                    bucket.iconsNeedLinear = true;
                }
            }

            if (iconSecondary) {
                const secondaryImageSerialized = iconSecondary.toString();
                secondaryImage = imageMap.get(secondaryImageSerialized);
            }
        }

        hasAnySecondaryIcon = hasAnySecondaryIcon || !!(feature.icon && feature.icon.hasSecondary());

        const shapedText = getDefaultHorizontalShaping(shapedTextOrientations.horizontal) || shapedTextOrientations.vertical;
        if (!bucket.iconsInText) {
            bucket.iconsInText = shapedText ? shapedText.iconsInText : false;
        }

        const glyphSize = ONE_EM,
            fontScale = layoutTextSize * sizes.textScaleFactor / glyphSize;
        const {defaultShapedIcon, verticallyShapedIcon} = fitIconsToText(bucket, shapedIcon, layout, feature, canonical, shapedTextOrientations, fontScale, iconOffset, iconTextFit);

        if (iconTextFit !== 'none' && shapedIcon && (isFullyStretchableX(shapedIcon) || isFullyStretchableY(shapedIcon))) {
            // For fully stretchable icons, we can rasterize them at the full resolution now that we know it
            scaleShapedIconImage(defaultShapedIcon.imagePrimary, primaryImage, iconPrimary, shapedIcon, defaultShapedIcon, iconTextFit, imageRasterizationTasks, imageMap, imagePositions);
            scaleShapedIconImage(defaultShapedIcon.imageSecondary, secondaryImage, iconSecondary, shapedIcon, defaultShapedIcon, iconTextFit, imageRasterizationTasks, imageMap, imagePositions);
            if (verticallyShapedIcon) {
                scaleShapedIconImage(verticallyShapedIcon.imagePrimary, primaryImage, iconPrimary, shapedIcon, verticallyShapedIcon, iconTextFit, imageRasterizationTasks, imageMap, imagePositions);
                scaleShapedIconImage(verticallyShapedIcon.imageSecondary, secondaryImage, iconSecondary, shapedIcon, verticallyShapedIcon, iconTextFit, imageRasterizationTasks, imageMap, imagePositions);
            }
        }

        shapedIcon = defaultShapedIcon;

        const {iconBBox, iconVerticalBBox, textBBox, textVerticalBBox} = mergeAppearancesBboxes(bucket, shapedIcon, verticallyShapedIcon,
            layout, feature, canonical, layoutIconSize, iconOffset, sizes, imagePositions, iconAnchor, shapedTextOrientations, layoutTextSize, textOffset, availableImages);

        featureData.push({
            feature,
            shapedTextOrientations,
            shapedText,
            shapedIcon,
            iconPrimary,
            iconSecondary,
            iconOffset,
            iconAnchor,
            verticallyShapedIcon,
            layoutTextSize,
            layoutIconSize,
            textOffset,
            isSDFIcon,
            iconTextFit,
            iconCollisionBounds: iconBBox,
            iconVerticalCollisionBounds: iconVerticalBBox,
            textCollisionBounds: textBBox,
            textVerticalCollisionBounds: textVerticalBBox
        });

    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return {featureData, sizes, hasAnySecondaryIcon, textAlongLine, symbolPlacement};

}

function getLayoutProperties(layout: PossiblyEvaluated<LayoutProps>, feature: SymbolFeature, canonical: CanonicalTileID) {
    const baseIconRotate = layout.get('icon-rotate').evaluate(feature, {}, canonical);
    const baseTextRotate = layout.get('text-rotate').evaluate(feature, {}, canonical);
    const [iconSizeScaleRangeMin, iconSizeScaleRangeMax] = layout.get('icon-size-scale-range');
    const iconScaleFactor = clamp(1, iconSizeScaleRangeMin, iconSizeScaleRangeMax);
    return {baseIconRotate, baseTextRotate, iconScaleFactor};
}

function mergeAppearancesBboxes(bucket: SymbolBucket, shapedIcon: PositionedIcon, verticallyShapedIcon: PositionedIcon, layout: PossiblyEvaluated<LayoutProps>,
    feature: SymbolFeature, canonical: CanonicalTileID, layoutIconSize: number, iconOffset: [number, number], sizes: Sizes, imagePositions: ImagePositionMap,
    iconAnchor: SymbolAnchor, shapedTextOrientations: ShapedTextOrientations, layoutTextSize: number, textOffset: [number, number], availableImages: ImageId[]
) {
    const symbolLayer = bucket.layers[0];
    const appearances = symbolLayer.appearances;
    if (appearances.length === 0) {
        return {iconBBox: null, iconVerticalBBox: null, textBBox: null, textVerticalBBox: null};
    }

    // Calculate combined icon and text bounding boxes that encompass the main icon and all appearance variants
    const iconBBoxes: {
        iconBBox: SymbolBoundingBox | null,
        iconVerticalBBox: SymbolBoundingBox | null
    } = {
        iconBBox: null,
        iconVerticalBBox: null
    };
    const textBBoxes: {
        textBBox: SymbolBoundingBox | null,
        textVerticalBBox: SymbolBoundingBox | null
    } = {
        textBBox: null,
        textVerticalBBox: null
    };
    const {baseIconRotate, baseTextRotate, iconScaleFactor} = getLayoutProperties(layout, feature, canonical);

    // Compute the base bbox using layout properties
    if (shapedIcon) {
        iconBBoxes.iconBBox = getUpdateSymbolBoundingBox(shapedIcon, iconBBoxes.iconBBox, baseIconRotate, layoutIconSize);

        if (verticallyShapedIcon) {
            const verticalIconRotate = baseIconRotate + 90.0;
            iconBBoxes.iconVerticalBBox = getUpdateSymbolBoundingBox(verticallyShapedIcon, iconBBoxes.iconVerticalBBox, verticalIconRotate, layoutIconSize);
        }
    }

    const defaultHorizontalShaping = getDefaultHorizontalShaping(shapedTextOrientations.horizontal);
    if (defaultHorizontalShaping) {
        textBBoxes.textBBox = getUpdateSymbolBoundingBox(defaultHorizontalShaping, textBBoxes.textBBox, baseTextRotate, 1.0, textOffset);
    }

    if (shapedTextOrientations.vertical) {
        const verticalTextRotate = baseTextRotate + 90.0;
        textBBoxes.textVerticalBBox = getUpdateSymbolBoundingBox(shapedTextOrientations.vertical, textBBoxes.textVerticalBBox, verticalTextRotate, 1.0, textOffset);
    }

    for (const appearance of appearances) {

        if (appearance.hasIconProperties()) {
            updateIconBoundingBoxes(iconBBoxes, bucket, symbolLayer, appearance, feature, canonical, iconOffset, baseIconRotate,
                layoutIconSize, sizes, shapedIcon, imagePositions, iconScaleFactor, iconAnchor, availableImages);
        }

        if (appearance.hasTextProperties()) {
            updateTextBoundingBoxes(textBBoxes, symbolLayer, appearance, feature, canonical, textOffset, baseTextRotate,
                layoutTextSize, defaultHorizontalShaping, shapedTextOrientations.vertical);
        }
    }

    return {iconBBox: iconBBoxes.iconBBox, iconVerticalBBox: iconBBoxes.iconVerticalBBox, textBBox: textBBoxes.textBBox, textVerticalBBox: textBBoxes.textVerticalBBox};
}

// Updates the icon bounding boxes with the appearance ones
function updateIconBoundingBoxes(input : {iconBBox: SymbolBoundingBox | null, iconVerticalBBox: SymbolBoundingBox | null}, bucket: SymbolBucket, symbolLayer: SymbolStyleLayer, appearance: SymbolAppearance, feature: SymbolFeature, canonical: CanonicalTileID,
    iconOffset: [number, number], baseIconRotate: number, layoutIconSize: number, sizes: Sizes, shapedIcon: PositionedIcon, imagePositions: ImagePositionMap, iconScaleFactor: number,
    iconAnchor: SymbolAnchor, availableImages: ImageId[]) {

    const {appearanceIconOffset, appearanceIconRotate, appearanceIconSize} = getAppearanceIconValues(appearance, symbolLayer, feature, canonical, iconOffset, baseIconRotate, layoutIconSize, sizes.iconScaleFactor);

    let appearanceShapedIcon: PositionedIcon | null = null;
    let appearanceVerticallyShapedIcon: PositionedIcon | null = null;

    let imagePositionToUse: ImagePosition = null;
    if (appearance.hasProperty('icon-image')) {
        imagePositionToUse = getAppearanceImagePosition(bucket, symbolLayer, appearance, feature, canonical, imagePositions, iconScaleFactor, availableImages);
    } else if (shapedIcon) {
        imagePositionToUse = shapedIcon.imagePrimary;
    }

    if (imagePositionToUse) {
        appearanceShapedIcon = shapeIcon(imagePositionToUse, null, appearanceIconOffset, iconAnchor);
        if (bucket.allowVerticalPlacement) {
            appearanceVerticallyShapedIcon = shapeIcon(imagePositionToUse, null, appearanceIconOffset, iconAnchor);
        }
    }

    // Add this appearance's contribution to the unified bounding boxes
    if (appearanceShapedIcon) {
        input.iconBBox = getUpdateSymbolBoundingBox(appearanceShapedIcon, input.iconBBox, appearanceIconRotate, appearanceIconSize);
    }
    if (appearanceVerticallyShapedIcon) {
        const verticalAppearanceIconRotate = appearanceIconRotate + 90.0;
        input.iconVerticalBBox = getUpdateSymbolBoundingBox(appearanceVerticallyShapedIcon, input.iconVerticalBBox, verticalAppearanceIconRotate, appearanceIconSize);
    }
}

export function getAppearanceIconValues(appearance: SymbolAppearance, symbolLayer: SymbolStyleLayer, feature: SymbolFeature,
    canonical: CanonicalTileID, iconOffset: [number, number], baseIconRotate: number, layoutIconSize: number, iconScaleFactor: number) {
    const appearanceIconOffsetValue = appearance.hasProperty('icon-offset') ?
        symbolLayer.getAppearanceValueAndResolveTokens(appearance, 'icon-offset', feature, canonical, []) :
        null;
    const appearanceIconOffset = (appearanceIconOffsetValue && Array.isArray(appearanceIconOffsetValue)) ?
        appearanceIconOffsetValue as unknown as [number, number] :
        iconOffset;

    const appearanceIconRotateValue = appearance.hasProperty('icon-rotate') ?
        symbolLayer.getAppearanceValueAndResolveTokens(appearance, 'icon-rotate', feature, canonical, []) :
        null;
    const appearanceIconRotate = (typeof appearanceIconRotateValue === 'number') ?
        appearanceIconRotateValue :
        baseIconRotate;

    const appearanceIconSizeValue = appearance.hasProperty('icon-size') ?
        symbolLayer.getAppearanceValueAndResolveTokens(appearance, 'icon-size', feature, canonical, []) :
        null;
    const appearanceIconSize = (typeof appearanceIconSizeValue === 'number') ?
        appearanceIconSizeValue * iconScaleFactor :
        layoutIconSize;

    return {appearanceIconOffset, appearanceIconRotate, appearanceIconSize};
}

function getAppearanceImagePosition(bucket: SymbolBucket, symbolLayer: SymbolStyleLayer, appearance: SymbolAppearance, feature: SymbolFeature, canonical: CanonicalTileID,
    imagePositions: ImagePositionMap, iconScaleFactor: number, availableImages: ImageId[]) {
    let imagePositionToUse: ImagePosition = null;
    const appearanceIconImage = symbolLayer.getAppearanceValueAndResolveTokens(appearance, 'icon-image', feature, canonical, availableImages);
    if (appearanceIconImage) {
        const icon = bucket.getResolvedImageFromTokens(appearanceIconImage as string);
        const unevaluatedIconSize = appearance.getUnevaluatedProperty('icon-size') as PropertyValue<number, PossiblyEvaluatedPropertyValue<number>>;
        const iconSizeData = getSizeData(bucket.zoom, unevaluatedIconSize, bucket.worldview, availableImages);
        const imageVariant = getScaledImageVariant(icon, iconSizeData, unevaluatedIconSize, canonical, bucket.zoom, feature, bucket.pixelRatio, iconScaleFactor, bucket.worldview, availableImages);
        imagePositionToUse = imagePositions.get(imageVariant.iconPrimary.toString());
    }
    return imagePositionToUse;
}

function updateTextBoundingBoxes(input: {textBBox: SymbolBoundingBox | null, textVerticalBBox: SymbolBoundingBox | null}, symbolLayer: SymbolStyleLayer, appearance: SymbolAppearance, feature: SymbolFeature, canonical: CanonicalTileID,
    textOffset: [number, number], baseTextRotate: number, layoutTextSize: number, defaultHorizontalShaping: Shaping, defaultVerticalShaping: Shaping) {
    const {appearanceTextOffset, appearanceTextRotate, appearanceTextSize} = getAppearanceTextValues(appearance, symbolLayer, feature, canonical, textOffset, baseTextRotate, layoutTextSize);
    // Calculate scale ratio between appearance text size and base text size
    const textSizeScale = appearanceTextSize / layoutTextSize;

    // Add this appearance's text contribution to the unified bounding boxes
    if (defaultHorizontalShaping) {
        input.textBBox = getUpdateSymbolBoundingBox(defaultHorizontalShaping, input.textBBox, appearanceTextRotate, textSizeScale, appearanceTextOffset);
    }

    if (defaultVerticalShaping) {
        const verticalAppearanceTextRotate = appearanceTextRotate + 90.0;
        input.textVerticalBBox = getUpdateSymbolBoundingBox(defaultVerticalShaping, input.textVerticalBBox, verticalAppearanceTextRotate, textSizeScale, appearanceTextOffset);
    }
}

export function getAppearanceTextValues(appearance: SymbolAppearance, symbolLayer: SymbolStyleLayer, feature: SymbolFeature,
    canonical: CanonicalTileID, textOffset: [number, number], baseTextRotate: number, layoutTextSize: number) {
    const appearanceTextOffsetValue = appearance.hasProperty('text-offset') ?
        symbolLayer.getAppearanceValueAndResolveTokens(appearance, 'text-offset', feature, canonical, []) :
        null;
    const appearanceTextOffset = (appearanceTextOffsetValue && Array.isArray(appearanceTextOffsetValue)) ?
        [appearanceTextOffsetValue[0] * ONE_EM, appearanceTextOffsetValue[1] * ONE_EM] as [number, number] :
        textOffset;

    const appearanceTextRotateValue = appearance.hasProperty('text-rotate') ?
        symbolLayer.getAppearanceValueAndResolveTokens(appearance, 'text-rotate', feature, canonical, []) :
        null;
    const appearanceTextRotate = (typeof appearanceTextRotateValue === 'number') ?
        appearanceTextRotateValue :
        baseTextRotate;

    const appearanceTextSizeValue = appearance.hasProperty('text-size') ?
        symbolLayer.getAppearanceValueAndResolveTokens(appearance, 'text-size', feature, canonical, []) :
        null;
    const appearanceTextSize = (typeof appearanceTextSizeValue === 'number') ?
        appearanceTextSizeValue :
        layoutTextSize;

    return {appearanceTextOffset, appearanceTextRotate, appearanceTextSize};
}

function scaleShapedIconImage(outImagePosition: ImagePosition, image: StyleImage, variant: ImageVariant, beforeFitIcon: PositionedIcon, afterFitIcon: PositionedIcon,
    iconTextFit: IconTextFit, imageRasterizationTasks: ImageRasterizationTasks, imageMap: StyleImageMap<StringifiedImageVariant>, imagePositions: ImagePositionMap) {
    if (!image || !image.usvg) return;

    const beforeFitIconSize = getPositionedIconSize(beforeFitIcon);
    const afterFitIconSize = getPositionedIconSize(afterFitIcon);
    const widthMultiplier = (iconTextFit === 'both' || iconTextFit === 'width') && isFullyStretchableX(beforeFitIcon) ? (afterFitIconSize.width / beforeFitIconSize.width) : 1;
    const heightMultiplier = (iconTextFit === 'both' || iconTextFit === 'height') && isFullyStretchableY(beforeFitIcon) ?  (afterFitIconSize.height / beforeFitIconSize.height) : 1;
    variant.scaleSelf(widthMultiplier, heightMultiplier);

    const scaledIconId = variant.toString();
    imageRasterizationTasks.set(scaledIconId, variant);
    imageMap.set(scaledIconId, image);
    const {imagePosition} = getImagePosition(scaledIconId, image, ICON_PADDING);
    imagePositions.set(scaledIconId, imagePosition);
    outImagePosition = imagePosition;
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

export function checkCrossFadeImagePositions(primary: ImageVariant, secondary: ImageVariant, iconPositions: ImagePositionMap) {
    if (!secondary) return;
    const primaryPosition = iconPositions.get(primary.toString());
    const secondaryPosition = iconPositions.get(secondary.toString());

    if (!primaryPosition || !secondaryPosition) {
        return;
    }

    if (primaryPosition.paddedRect.w !== secondaryPosition.paddedRect.w ||
        primaryPosition.paddedRect.h !== secondaryPosition.paddedRect.h) {
        warnOnce(`Mismatch in icon variant sizes: ${primary.toString()} and ${secondary.toString()}`);
    }

    if (primaryPosition.usvg !== secondaryPosition.usvg) {
        warnOnce(`Mismatch in icon variant image types: ${primary.id} and ${secondary.id}`);
    }
}

export function postRasterizationSymbolLayout(bucket: SymbolBucket, bucketData: SymbolBucketData, showCollisionBoxes: boolean,
    availableImages: ImageId[], canonical: CanonicalTileID, tileZoom: number, projection: Projection, brightness: number | null, imageMap: StyleImageMap<StringifiedImageVariant>, imageAtlas: ImageAtlas) {

    bucket.iconAtlasPositions = imageAtlas.iconPositions;
    const {featureData, hasAnySecondaryIcon, sizes, textAlongLine, symbolPlacement} = bucketData;

    for (const data of featureData) {
        const {shapedIcon, verticallyShapedIcon, feature, shapedTextOrientations, shapedText, layoutTextSize, layoutIconSize,
            textOffset, isSDFIcon, iconPrimary, iconSecondary, iconTextFit, iconOffset, iconCollisionBounds, iconVerticalCollisionBounds,
            textCollisionBounds, textVerticalCollisionBounds} = data;

        // Image positions in shapedIcon and shapedText need to be updated since after rasterization, positions in the atlas will have
        // changed
        reconcileImagePosition(shapedIcon, imageAtlas.iconPositions, iconPrimary, iconSecondary);
        reconcileImagePosition(verticallyShapedIcon, imageAtlas.iconPositions, iconPrimary, iconSecondary);
        reconcileTextImagePositions(shapedTextOrientations, imageAtlas.iconPositions);
        checkCrossFadeImagePositions(iconPrimary, iconSecondary, imageAtlas.iconPositions);

        if (shapedText || shapedIcon) {
            addFeature(bucket, feature, shapedTextOrientations, shapedIcon, verticallyShapedIcon, imageMap, sizes, layoutTextSize,
                layoutIconSize, textOffset, isSDFIcon, availableImages, canonical, projection, brightness, hasAnySecondaryIcon, iconTextFit,
                iconOffset, textAlongLine, symbolPlacement, iconCollisionBounds, iconVerticalCollisionBounds, textCollisionBounds, textVerticalCollisionBounds);
        }
    }

    if (showCollisionBoxes) {
        bucket.generateCollisionDebugBuffers(tileZoom, bucket.collisionBoxArray, sizes.textScaleFactor);
    }
}

function reconcileImagePosition(shapedIcon: PositionedIcon, atlasIconPositions: ImagePositionMap, iconPrimary: ImageVariant, iconSecondary: ImageVariant) {
    if (!shapedIcon) return;

    const primaryImagePosition = atlasIconPositions.get(iconPrimary.toString());
    shapedIcon.imagePrimary = primaryImagePosition;
    if (iconSecondary) {
        const secondaryImagePosition = atlasIconPositions.get(iconSecondary.toString());
        shapedIcon.imageSecondary = secondaryImagePosition;
    }
}

function reconcileTextImagePositions(shapedTextOrientations: ShapedTextOrientations, atlasIconPositions: ImagePositionMap) {
    // Image position in shapedIcon needs to be updated since after rasterization, positions in the atlas might have
    // changed

    for (const orientation in shapedTextOrientations.horizontal) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        reconcileTextOrientationImagePositions(shapedTextOrientations.horizontal[orientation], atlasIconPositions);
    }

    reconcileTextOrientationImagePositions(shapedTextOrientations.vertical, atlasIconPositions);
}

function reconcileTextOrientationImagePositions(shapedText: Shaping | null, atlasIconPositions: ImagePositionMap) {
    if (!shapedText) return;

    for (const line of shapedText.positionedLines) {
        for (const glyph of line.positionedGlyphs) {
            if (glyph.image !== null) {
                const imageId = glyph.image.toString();
                glyph.rect = atlasIconPositions.get(imageId).paddedRect;
            }
        }
    }
}

// Choose the justification that matches the direction of the TextAnchor
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

/**
 * for "very" overscaled tiles (overscaleFactor > 2) on high zoom levels (z > 18)
 * we use the tile pixel ratio from the previous zoom level and clamp it to 1
 * in order to thin out labels density and save memory and CPU .
 * @private
 */
function tilePixelRatioForSymbolSpacing(overscaleFactor: number, overscaledZ: number) {
    if (overscaledZ > 18 && overscaleFactor > 2) {
        overscaleFactor >>= 1;
    }
    const tilePixelRatio = EXTENT / (512 * overscaleFactor);
    return Math.max(tilePixelRatio, 1);
}

type IconTextFit = "none" | "height" | "width" | "both";

function fitIconsToText(bucket: SymbolBucket, shapedIcon: PositionedIcon | undefined, layout: PossiblyEvaluated<LayoutProps>, feature: SymbolFeature,
    canonical: CanonicalTileID, shapedTextOrientations: ShapedTextOrientations, fontScale: number,
    iconOffset: [number, number], iconTextFit: IconTextFit): {defaultShapedIcon: PositionedIcon, verticallyShapedIcon: PositionedIcon | undefined} {
    const defaultShaping = getDefaultHorizontalShaping(shapedTextOrientations.horizontal) || shapedTextOrientations.vertical;
    const iconTextFitPadding = layout.get('icon-text-fit-padding').evaluate(feature, {}, canonical);
    const hasIconTextFit = iconTextFit !== 'none';
    let defaultShapedIcon = shapedIcon;
    let verticallyShapedIcon;
    if (shapedIcon && hasIconTextFit) {
        if (bucket.allowVerticalPlacement && shapedTextOrientations.vertical) {
            verticallyShapedIcon = fitIconToText(shapedIcon, shapedTextOrientations.vertical, iconTextFit,
                iconTextFitPadding, iconOffset, fontScale);
        }
        if (defaultShaping) {
            defaultShapedIcon = fitIconToText(shapedIcon, defaultShaping, iconTextFit,
                                       iconTextFitPadding, iconOffset, fontScale);
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return {defaultShapedIcon, verticallyShapedIcon};
}

export function computeFontScale(textSize: number, textScaleFactor: number) {
    const glyphSize = ONE_EM;
    const fontScale = textSize * textScaleFactor / glyphSize;
    return fontScale;
}

/**
 * Given a feature and its shaped text and icon data, add a 'symbol
 * instance' for each _possible_ placement of the symbol feature.
 * (At render time Placement.updateBucketOpacities() selects which of these
 * instances to show or hide based on collisions with symbols in other layers.)
 * @private
 */
function addFeature(bucket: SymbolBucket,
                    feature: SymbolFeature,
                    shapedTextOrientations: ShapedTextOrientations,
                    shapedIcon: PositionedIcon | undefined,
                    verticallyShapedIcon: PositionedIcon | undefined,
                    imageMap: StyleImageMap<StringifiedImageVariant>,
                    sizes: Sizes,
                    layoutTextSize: number,
                    layoutIconSize: number,
                    textOffset: [number, number],
                    isSDFIcon: boolean,
                    availableImages: ImageId[],
                    canonical: CanonicalTileID,
                    projection: Projection,
                    brightness: number | null | undefined,
                    hasAnySecondaryIcon: boolean,
                    iconTextFit: "none" | "width" | "height" | "both",
                    iconOffset: [number, number],
                    textAlongLine: boolean,
                    symbolPlacement: "point" | "line" | "line-center",
                    iconCollisionBounds?: SymbolBoundingBox | null,
                    iconVerticalCollisionBounds?: SymbolBoundingBox | null,
                    textCollisionBounds?: SymbolBoundingBox | null,
                    textVerticalCollisionBounds?: SymbolBoundingBox | null,) {
    // To reduce the number of labels that jump around when zooming we need
    // to use a text-size value that is the same for all zoom levels.
    // bucket calculates text-size at a high zoom level so that all tiles can
    // use the same value when calculating anchor positions.
    let textMaxSize = sizes.textMaxSize.evaluate(feature, {}, canonical);
    if (textMaxSize === undefined) {
        textMaxSize = layoutTextSize * sizes.textScaleFactor;
    } else {
        textMaxSize *= sizes.textScaleFactor;
    }
    const layout = bucket.layers[0].layout;

    const glyphSize = ONE_EM;
    const fontScale = computeFontScale(layoutTextSize, sizes.textScaleFactor);

    const defaultShaping = getDefaultHorizontalShaping(shapedTextOrientations.horizontal) || shapedTextOrientations.vertical;

    // Store text shaping data for icon-text-fit and text appearance updates
    const hasTextAppearances = bucket.hasAnyAppearanceProperty(['text-size', 'text-offset', 'text-rotate']);
    if ((iconTextFit !== 'none' || hasTextAppearances) && bucket.appearanceFeatureData && bucket.featureToAppearanceIndex[feature.index] < bucket.appearanceFeatureData.length) {
        const featureData = bucket.appearanceFeatureData[bucket.featureToAppearanceIndex[feature.index]];
        if (featureData) {
            featureData.textShaping = defaultShaping;
            featureData.iconTextFitPadding = layout.get('icon-text-fit-padding').evaluate(feature, {}, canonical);
            featureData.fontScale = fontScale;
            featureData.textScaleFactor = sizes.textScaleFactor;
        }
    }
    const isGlobe = projection.name === 'globe';

    const textMaxBoxScale = bucket.tilePixelRatio * textMaxSize / glyphSize,
        iconBoxScale = bucket.tilePixelRatio * layoutIconSize,
        symbolMinDistance = tilePixelRatioForSymbolSpacing(bucket.overscaling, bucket.zoom) * layout.get('symbol-spacing'),
        textPadding = layout.get('text-padding') * bucket.tilePixelRatio,
        iconPadding = layout.get('icon-padding') * bucket.tilePixelRatio,
        textMaxAngle = degToRad(layout.get('text-max-angle')),
        iconAlongLine = layout.get('icon-rotation-alignment') === 'map' && symbolPlacement !== 'point',
        textRepeatDistance = symbolMinDistance / 2;

    const hasIconTextFit = iconTextFit !== 'none';
    if (bucket.hasAnyIconTextFit === false && hasIconTextFit) {
        bucket.hasAnyIconTextFit = true;
    }

    const elevationFeatureId = feature.properties ? +feature.properties[PROPERTY_ELEVATION_ID] : null;
    const elevationFeatureIndex = elevationFeatureId && bucket.elevationFeatureIdToIndex ? bucket.elevationFeatureIdToIndex.get(elevationFeatureId) : 0xffff;

    const addSymbolAtAnchor = (line: Array<Point>, anchor: Anchor, canonicalId: CanonicalTileID) => {
        if (anchor.x < 0 || anchor.x >= EXTENT || anchor.y < 0 || anchor.y >= EXTENT) {
            // Symbol layers are drawn across tile boundaries, We filter out symbols
            // outside our tile boundaries (which may be included in vector tile buffers)
            // to prevent double-drawing symbols.
            return;
        }

        let globe: {
            anchor: Anchor;
            up: vec3;
        } | null | undefined = null;
        if (isGlobe) {
            const {x, y, z} = projection.projectTilePoint(anchor.x, anchor.y, canonicalId);
            globe = {
                anchor: new Anchor(x, y, z, 0, undefined),
                up: projection.upVector(canonicalId, anchor.x, anchor.y)
            };
        }

        addSymbol(bucket, anchor, globe, line, shapedTextOrientations,
            shapedIcon, imageMap, verticallyShapedIcon, bucket.layers[0],
            bucket.collisionBoxArray, feature.index, feature.sourceLayerIndex,
            bucket.index, textPadding, textAlongLine, textOffset,
            iconBoxScale, iconPadding, iconAlongLine, iconOffset,
            feature, sizes, isSDFIcon, availableImages, canonical,
            brightness, hasAnySecondaryIcon, iconTextFit, elevationFeatureIndex,
            iconCollisionBounds, iconVerticalCollisionBounds,
            textCollisionBounds, textVerticalCollisionBounds);
    };

    if (symbolPlacement === 'line') {
        for (const line of clipLines(feature.geometry, 0, 0, EXTENT, EXTENT)) {
            const anchors = getAnchors(
                line,
                symbolMinDistance,
                textMaxAngle,
                shapedTextOrientations.vertical || defaultShaping,
                shapedIcon,
                glyphSize,
                textMaxBoxScale,
                bucket.overscaling,
                EXTENT
            );
            for (const anchor of anchors) {
                const shapedText = defaultShaping;
                if (!shapedText || !anchorIsTooClose(bucket, shapedText.text, textRepeatDistance, anchor)) {
                    addSymbolAtAnchor(line, anchor, canonical);
                }
            }
        }
    } else if (symbolPlacement === 'line-center') {
        // No clipping, multiple lines per feature are allowed
        // "lines" with only one point are ignored as in clipLines
        for (const line of feature.geometry) {
            if (line.length > 1) {
                const anchor = getCenterAnchor(
                    line,
                    textMaxAngle,
                    shapedTextOrientations.vertical || defaultShaping,
                    shapedIcon,
                    glyphSize,
                    textMaxBoxScale);
                if (anchor) {
                    addSymbolAtAnchor(line, anchor, canonical);
                }
            }
        }
    } else if (feature.type === 'Polygon') {
        for (const polygon of classifyRings(feature.geometry, 0)) {
            // 16 here represents 2 pixels
            const poi = findPoleOfInaccessibility(polygon, 16);
            addSymbolAtAnchor(polygon[0], new Anchor(poi.x, poi.y, 0, 0, undefined), canonical);
        }
    } else if (feature.type === 'LineString') {
        // https://github.com/mapbox/mapbox-gl-js/issues/3808
        for (const line of feature.geometry) {
            addSymbolAtAnchor(line, new Anchor(line[0].x, line[0].y, 0, 0, undefined), canonical);
        }
    } else if (feature.type === 'Point') {
        for (const points of feature.geometry) {
            for (const point of points) {
                addSymbolAtAnchor([point], new Anchor(point.x, point.y, 0, 0, undefined), canonical);
            }
        }
    }
}

const MAX_GLYPH_ICON_SIZE = 255;
const MAX_PACKED_SIZE = MAX_GLYPH_ICON_SIZE * SIZE_PACK_FACTOR;
export {MAX_PACKED_SIZE};

type PlacementTypes = 'vertical' | 'center' | 'left' | 'right';

function addTextVertices(bucket: SymbolBucket,
                         globe: {
                             anchor: Anchor;
                             up: vec3;
                         } | null | undefined,
                         tileAnchor: Anchor,
                         shapedText: Shaping,
                         imageMap: StyleImageMap<StringifiedImageVariant>,
                         layer: SymbolStyleLayer,
                         textAlongLine: boolean,
                         feature: SymbolFeature,
                         textOffset: [number, number],
                         lineArray: {
                             lineStartIndex: number;
                             lineLength: number;
                         },
                         writingMode: number,
                         placementTypes: Array<PlacementTypes>,
                         placedTextSymbolIndices: Record<string, number>,
                         placedIconIndex: number,
                         sizes: Sizes,
                         availableImages: ImageId[],
                         canonical: CanonicalTileID,
                         symbolInstanceIndex: number,
                         brightness?: number | null) {
    const glyphQuads = getGlyphQuads(tileAnchor, shapedText, textOffset,
                            layer, textAlongLine, feature, imageMap, bucket.allowVerticalPlacement, undefined);

    const evaluatedTextSize = layer.layout.get('text-size').evaluate(feature, {}, canonical);
    const minZoomSize = sizes.compositeTextSizes ? sizes.compositeTextSizes[0].evaluate(feature, {}, canonical) : 0;
    const maxZoomSize = sizes.compositeTextSizes ? sizes.compositeTextSizes[1].evaluate(feature, {}, canonical) : 0;
    const textSizeData = getSizeDataFromKind(bucket.layerIds[0], bucket.textSizeData, evaluatedTextSize, sizes.textScaleFactor, minZoomSize, maxZoomSize);

    bucket.addSymbols(
        bucket.text,
        glyphQuads,
        textSizeData,
        textOffset,
        textAlongLine,
        feature,
        writingMode,
        globe,
        tileAnchor,
        lineArray.lineStartIndex,
        lineArray.lineLength,
        placedIconIndex,
        availableImages,
        canonical,
        brightness,
        false,
        symbolInstanceIndex,
        glyphQuads.length);

    // The placedSymbolArray is used at render time in drawTileSymbols
    // These indices allow access to the array at collision detection time
    for (const placementType of placementTypes) {
        placedTextSymbolIndices[placementType] = bucket.text.placedSymbolArray.length - 1;
    }

    return glyphQuads.length * 4;
}

export function getSizeDataFromKind(layerId: string, inputSizeData: SizeData, evaluatedTextSize: number, textScaleFactor: number,
    minZoomSize: number, maxZoomSize: number
) {
    const sizeData = inputSizeData;
    let textSizeData: number[] = null;

    if (sizeData.kind === 'source') {
        textSizeData = [
            SIZE_PACK_FACTOR * evaluatedTextSize * textScaleFactor
        ];
        if (textSizeData[0] > MAX_PACKED_SIZE) {
            warnOnce(`${layerId}: Value for "text-size" is >= ${MAX_GLYPH_ICON_SIZE}. Reduce your "text-size".`);
        }
    } else if (sizeData.kind === 'composite') {
        textSizeData = [
            SIZE_PACK_FACTOR * minZoomSize * textScaleFactor,
            SIZE_PACK_FACTOR * maxZoomSize * textScaleFactor
        ];
        if (textSizeData[0] > MAX_PACKED_SIZE || textSizeData[1] > MAX_PACKED_SIZE) {
            warnOnce(`${layerId}: Value for "text-size" is >= ${MAX_GLYPH_ICON_SIZE}. Reduce your "text-size".`);
        }
    }

    return textSizeData;
}

function getDefaultHorizontalShaping(horizontalShaping: Partial<Record<TextJustify, Shaping>>): Shaping | null {
    // We don't care which shaping we get because this is used for collision purposes
    // and all the justifications have the same collision box
    // eslint-disable-next-line no-unreachable-loop
    for (const justification in horizontalShaping) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return horizontalShaping[justification];
    }
    return null;
}

export function evaluateBoxCollisionFeature(
    collisionBoxArray: CollisionBoxArray,
    projectedAnchor: Anchor,
    tileAnchor: Anchor,
    featureIndex: number,
    sourceLayerIndex: number,
    bucketIndex: number,
    shaped: Shaping | PositionedIcon,
    padding: number,
    rotate: number,
    textOffset?: [number, number] | null,
    collisionBounds?: SymbolBoundingBox
): number {
    let y1: number, y2: number, x1: number, x2: number;

    y1 = collisionBounds ? collisionBounds.top : shaped.top;
    y2 = collisionBounds ? collisionBounds.bottom : shaped.bottom;
    x1 = collisionBounds ? collisionBounds.left : shaped.left;
    x2 = collisionBounds ? collisionBounds.right : shaped.right;

    if (isPositionedIcon(shaped) && shaped.collisionPadding) {
        const collisionPadding = shaped.collisionPadding;
        x1 -= collisionPadding[0];
        y1 -= collisionPadding[1];
        x2 += collisionPadding[2];
        y2 += collisionPadding[3];
    }

    if (rotate) {
        // Account for *-rotate in point collision boxes
        // See https://github.com/mapbox/mapbox-gl-js/issues/6075
        // Doesn't account for icon-text-fit

        const tl = new Point(x1, y1);
        const tr = new Point(x2, y1);
        const bl = new Point(x1, y2);
        const br = new Point(x2, y2);

        const rotateRadians = degToRad(rotate);
        let rotateCenter = new Point(0, 0);

        if (textOffset) {
            rotateCenter = new Point(textOffset[0], textOffset[1]);
        }

        tl._rotateAround(rotateRadians, rotateCenter);
        tr._rotateAround(rotateRadians, rotateCenter);
        bl._rotateAround(rotateRadians, rotateCenter);
        br._rotateAround(rotateRadians, rotateCenter);

        // Collision features require an "on-axis" geometry,
        // so take the envelope of the rotated geometry
        // (may be quite large for wide labels rotated 45 degrees)
        x1 = Math.min(tl.x, tr.x, bl.x, br.x);
        x2 = Math.max(tl.x, tr.x, bl.x, br.x);
        y1 = Math.min(tl.y, tr.y, bl.y, br.y);
        y2 = Math.max(tl.y, tr.y, bl.y, br.y);
    }

    collisionBoxArray.emplaceBack(projectedAnchor.x, projectedAnchor.y, projectedAnchor.z, tileAnchor.x, tileAnchor.y, x1, y1, x2, y2, padding, featureIndex, sourceLayerIndex, bucketIndex);

    return collisionBoxArray.length - 1;
}

export function evaluateCircleCollisionFeature(shaped: Shaping | PositionedIcon): number | null {
    if (isPositionedIcon(shaped) && shaped.collisionPadding) {
        // Compute height of the shape in glyph metrics and apply padding.
        // Note that the pixel based 'text-padding' is applied at runtime
        shaped.top -= shaped.collisionPadding[1];
        shaped.bottom += shaped.collisionPadding[3];
    }

    // Set minimum box height to avoid very many small labels
    const height = shaped.bottom - shaped.top;
    return height > 0 ? Math.max(10, height) : null;
}

/**
 * Add a single label & icon placement.
 *
 * @private
 */
function addSymbol(bucket: SymbolBucket,
                    anchor: Anchor,
                    globe: {
                        anchor: Anchor;
                        up: vec3;
                    } | null | undefined,
                    line: Array<Point>,
                    shapedTextOrientations: ShapedTextOrientations,
                    shapedIcon: PositionedIcon | undefined,
                    imageMap: StyleImageMap<StringifiedImageVariant>,
                    verticallyShapedIcon: PositionedIcon | undefined,
                    layer: SymbolStyleLayer,
                    collisionBoxArray: CollisionBoxArray,
                    featureIndex: number,
                    sourceLayerIndex: number,
                    bucketIndex: number,
                    textPadding: number,
                    textAlongLine: boolean,
                    textOffset: [number, number],
                    iconBoxScale: number,
                    iconPadding: number,
                    iconAlongLine: boolean,
                    iconOffset: [number, number],
                    feature: SymbolFeature,
                    sizes: Sizes,
                    isSDFIcon: boolean,
                    availableImages: ImageId[],
                    canonical: CanonicalTileID,
                    brightness: number | null | undefined,
                    hasAnySecondaryIcon: boolean,
                    iconTextFit: "none" | "width" | "height" | "both",
                    elevationFeatureIndex: number,
                    iconCollisionBounds?: SymbolBoundingBox | null,
                    iconVerticalCollisionBounds?: SymbolBoundingBox | null,
                    textCollisionBounds?: SymbolBoundingBox | null,
                    textVerticalCollisionBounds?: SymbolBoundingBox | null) {
    const lineArray = bucket.addToLineVertexArray(anchor, line);
    let textBoxIndex, iconBoxIndex, verticalTextBoxIndex, verticalIconBoxIndex;
    let textCircle, verticalTextCircle, verticalIconCircle;

    let numIconVertices = 0;
    let numVerticalIconVertices = 0;
    let numHorizontalGlyphVertices = 0;
    let numVerticalGlyphVertices = 0;
    let placedIconSymbolIndex = -1;
    let verticalPlacedIconSymbolIndex = -1;
    const placedTextSymbolIndices: Record<string, number> = {};
    let key = murmur3('');
    const collisionFeatureAnchor: Anchor = globe ? globe.anchor : anchor;

    const hasIconTextFit = iconTextFit !== 'none';

    let textOffset0 = 0;
    let textOffset1 = 0;
    if (layer._unevaluatedLayout.getValue('text-radial-offset') === undefined) {
        const evaluatedTextOffset = layer.layout.get('text-offset').evaluate(feature, {}, canonical);
        textOffset0 = evaluatedTextOffset[0] * ONE_EM;
        textOffset1 = evaluatedTextOffset[1] * ONE_EM;
    } else {
        textOffset0 = layer.layout.get('text-radial-offset').evaluate(feature, {}, canonical) * ONE_EM;
        textOffset1 = INVALID_TEXT_OFFSET;
    }

    if (bucket.allowVerticalPlacement && shapedTextOrientations.vertical) {
        const verticalShaping = shapedTextOrientations.vertical;
        if (textAlongLine) {
            verticalTextCircle = evaluateCircleCollisionFeature(verticalShaping);
            if (verticallyShapedIcon) {
                verticalIconCircle = evaluateCircleCollisionFeature(verticallyShapedIcon);
            }
        } else {
            const textRotation = layer.layout.get('text-rotate').evaluate(feature, {}, canonical);
            const verticalTextRotation = textRotation + 90.0;
            verticalTextBoxIndex = evaluateBoxCollisionFeature(collisionBoxArray, collisionFeatureAnchor, anchor, featureIndex, sourceLayerIndex, bucketIndex, verticalShaping, textPadding, verticalTextRotation, textOffset, textCollisionBounds);
            if (verticallyShapedIcon) {
                verticalIconBoxIndex = evaluateBoxCollisionFeature(collisionBoxArray, collisionFeatureAnchor, anchor, featureIndex, sourceLayerIndex, bucketIndex, verticallyShapedIcon, iconPadding, verticalTextRotation, null, iconVerticalCollisionBounds);
            }
        }
    }

    // Place icon first, so text can have a reference to its index in the placed symbol array.
    // Text symbols can lazily shift at render-time because of variable anchor placement.
    // If the style specifies an `icon-text-fit` then the icon would have to shift along with it.
    // For more info check `updateVariableAnchors` in `draw_symbol.js` .

    if (shapedIcon) {
        const iconRotate = layer.layout.get('icon-rotate').evaluate(feature, {}, canonical);
        const iconQuads = getIconQuads(shapedIcon, iconRotate, isSDFIcon, hasIconTextFit, sizes.iconScaleFactor);
        const verticalIconQuads = verticallyShapedIcon ? getIconQuads(verticallyShapedIcon, iconRotate, isSDFIcon, hasIconTextFit, sizes.iconScaleFactor) : undefined;
        iconBoxIndex = evaluateBoxCollisionFeature(collisionBoxArray, collisionFeatureAnchor, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedIcon, iconPadding, iconRotate, null, iconCollisionBounds);
        // Calculate maximum quads needed across layout icon and all appearance variants
        // to prevent vertex buffer overflow during appearance updates
        const maxQuadCount = calculateMaxIconQuadCount(bucket, iconQuads, verticalIconQuads,
            layer.layout, feature, canonical, bucket.iconAtlasPositions,
            hasIconTextFit, availableImages);
        numIconVertices = maxQuadCount * 4;

        const evaluatedIconSize = layer.layout.get('icon-size').evaluate(feature, {}, canonical, availableImages);
        const minZoomSize = sizes.compositeIconSizes ? sizes.compositeIconSizes[0].evaluate(feature, {}, canonical, availableImages) : 0;
        const maxZoomSize = sizes.compositeIconSizes ? sizes.compositeIconSizes[1].evaluate(feature, {}, canonical, availableImages) : 0;
        const iconSizeData = getSizeDataFromKind(bucket.layerIds[0], bucket.iconSizeData, evaluatedIconSize, sizes.iconScaleFactor, minZoomSize, maxZoomSize);

        bucket.addSymbols(
            bucket.icon,
            iconQuads,
            iconSizeData,
            iconOffset,
            iconAlongLine,
            feature,
            undefined,
            globe,
            anchor,
            lineArray.lineStartIndex,
            lineArray.lineLength,
            // The icon itself does not have an associated symbol since the text isnt placed yet
            -1,
            availableImages,
            canonical,
            brightness,
            hasAnySecondaryIcon,
            bucket.symbolInstances.length,
            maxQuadCount);

        placedIconSymbolIndex = bucket.icon.placedSymbolArray.length - 1;

        if (verticalIconQuads) {
            numVerticalIconVertices = maxQuadCount * 4;

            bucket.addSymbols(
                bucket.icon,
                verticalIconQuads,
                iconSizeData,
                iconOffset,
                iconAlongLine,
                feature,
                WritingMode.vertical,
                globe,
                anchor,
                lineArray.lineStartIndex,
                lineArray.lineLength,
                // The icon itself does not have an associated symbol since the text isnt placed yet
                -1,
                availableImages,
                canonical,
                brightness,
                hasAnySecondaryIcon,
                bucket.symbolInstances.length,
                maxQuadCount);

            verticalPlacedIconSymbolIndex = bucket.icon.placedSymbolArray.length - 1;
        }
    }

    for (const placement in shapedTextOrientations.horizontal) {
        const justification = placement as PlacementTypes;
        const shaping = shapedTextOrientations.horizontal[justification];

        if (!textBoxIndex) {
            key = murmur3(shaping.text);
            // As a collision approximation, we can use either the vertical or any of the horizontal versions of the feature
            // We're counting on all versions having similar dimensions
            if (textAlongLine) {
                textCircle = evaluateCircleCollisionFeature(shaping);
            } else {

                const textRotate = layer.layout.get('text-rotate').evaluate(feature, {}, canonical);
                textBoxIndex = evaluateBoxCollisionFeature(collisionBoxArray, collisionFeatureAnchor, anchor, featureIndex, sourceLayerIndex, bucketIndex, shaping, textPadding, textRotate, textOffset, textCollisionBounds);
            }
        }

        const singleLine = shaping.positionedLines.length === 1;
        numHorizontalGlyphVertices += addTextVertices(
            bucket, globe, anchor, shaping, imageMap, layer, textAlongLine, feature, textOffset, lineArray,
            shapedTextOrientations.vertical ? WritingMode.horizontal : WritingMode.horizontalOnly,
            singleLine ? keys(shapedTextOrientations.horizontal) : [justification],
            placedTextSymbolIndices, placedIconSymbolIndex, sizes, availableImages, canonical, bucket.symbolInstances.length, brightness);

        if (singleLine) {
            break;
        }
    }

    if (shapedTextOrientations.vertical) {
        numVerticalGlyphVertices += addTextVertices(
            bucket, globe, anchor, shapedTextOrientations.vertical, imageMap, layer, textAlongLine, feature,
            textOffset, lineArray, WritingMode.vertical, ['vertical'], placedTextSymbolIndices,
            verticalPlacedIconSymbolIndex, sizes, availableImages, canonical, bucket.symbolInstances.length, brightness);
    }

    // Check if runtime collision circles should be used for any of the collision features.
    // It is enough to choose the tallest feature shape as circles are always placed on a line.
    // All measurements are in glyph metrics and later converted into pixels using proper font size "layoutTextSize"
    let collisionCircleDiameter = -1;

    const getCollisionCircleHeight = (diameter: number | null | undefined, prevHeight: number): number => {
        return diameter ? Math.max(diameter, prevHeight) : prevHeight;
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    collisionCircleDiameter = getCollisionCircleHeight(textCircle, collisionCircleDiameter);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    collisionCircleDiameter = getCollisionCircleHeight(verticalTextCircle, collisionCircleDiameter);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    collisionCircleDiameter = getCollisionCircleHeight(verticalIconCircle, collisionCircleDiameter);
    const useRuntimeCollisionCircles = (collisionCircleDiameter > -1) ? 1 : 0;

    if (bucket.glyphOffsetArray.length >= SymbolBucketConstants.MAX_GLYPHS) warnOnce(
        "Too many glyphs being rendered in a tile. See https://github.com/mapbox/mapbox-gl-js/issues/2907"
    );

    if (feature.sortKey !== undefined) {
        bucket.addToSortKeyRanges(bucket.symbolInstances.length, feature.sortKey);
    }

    const projectedAnchor = collisionFeatureAnchor;

    bucket.symbolInstances.emplaceBack(
        anchor.x,
        anchor.y,
        projectedAnchor.x,
        projectedAnchor.y,
        projectedAnchor.z,
        placedTextSymbolIndices.right >= 0 ? placedTextSymbolIndices.right : -1,
        placedTextSymbolIndices.center >= 0 ? placedTextSymbolIndices.center : -1,
        placedTextSymbolIndices.left >= 0 ? placedTextSymbolIndices.left : -1,
        placedTextSymbolIndices.vertical  >= 0 ? placedTextSymbolIndices.vertical : -1,
        placedIconSymbolIndex,
        verticalPlacedIconSymbolIndex,
        key,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        textBoxIndex !== undefined ? textBoxIndex : bucket.collisionBoxArray.length,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        textBoxIndex !== undefined ? textBoxIndex + 1 : bucket.collisionBoxArray.length,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        verticalTextBoxIndex !== undefined ? verticalTextBoxIndex : bucket.collisionBoxArray.length,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        verticalTextBoxIndex !== undefined ? verticalTextBoxIndex + 1 : bucket.collisionBoxArray.length,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        iconBoxIndex !== undefined ? iconBoxIndex : bucket.collisionBoxArray.length,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        iconBoxIndex !== undefined ? iconBoxIndex + 1 : bucket.collisionBoxArray.length,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        verticalIconBoxIndex ? verticalIconBoxIndex : bucket.collisionBoxArray.length,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        verticalIconBoxIndex ? verticalIconBoxIndex + 1 : bucket.collisionBoxArray.length,
        featureIndex,
        numHorizontalGlyphVertices,
        numVerticalGlyphVertices,
        numIconVertices,
        numVerticalIconVertices,
        useRuntimeCollisionCircles,
        0,
        textOffset0,
        textOffset1,
        collisionCircleDiameter,
        0,
        hasIconTextFit ? 1 : 0,
        elevationFeatureIndex,
    );
}

function anchorIsTooClose(bucket: SymbolBucket, text: string, repeatDistance: number, anchor: Point) {
    const compareText = bucket.compareText;
    if (!(text in compareText)) {
        compareText[text] = [];
    } else {
        const otherAnchors = compareText[text];
        for (let k = otherAnchors.length - 1; k >= 0; k--) {
            if (anchor.dist(otherAnchors[k]) < repeatDistance) {
                // If it's within repeatDistance of one anchor, stop looking
                return true;
            }
        }
    }
    // If anchor is not within repeatDistance of any other anchor, add to array
    compareText[text].push(anchor);
    return false;
}

function calculateMaxIconQuadCount(
    bucket: SymbolBucket,
    iconQuads: Array<SymbolQuad>,
    verticalIconQuads: Array<SymbolQuad> | undefined,
    layout: PossiblyEvaluated<LayoutProps>,
    feature: SymbolFeature,
    canonical: CanonicalTileID,
    imagePositions: ImagePositionMap,
    hasIconTextFit: boolean,
    availableImages: ImageId[],
): number {
    const symbolLayer = bucket.layers[0];
    const appearances = symbolLayer.appearances;

    // Start with the layout icon quad count
    let maxQuadCount = iconQuads.length;

    // Check vertical icon quads if they exist
    if (verticalIconQuads) {
        maxQuadCount = Math.max(maxQuadCount, verticalIconQuads.length);
    }

    if (appearances.length === 0) {
        return maxQuadCount;
    }

    const [iconSizeScaleRangeMin, iconSizeScaleRangeMax] = layout.get('icon-size-scale-range');
    const iconScaleFactor = clamp(1, iconSizeScaleRangeMin, iconSizeScaleRangeMax);

    // Check each appearance that has an icon to find maximum quad count needed
    for (const appearance of appearances) {
        const unevaluatedProperties = appearance.getUnevaluatedProperties();
        const iconImageProperty = unevaluatedProperties._values['icon-image'].value !== undefined;

        if (iconImageProperty) {
            const appearanceIconImage = symbolLayer.getAppearanceValueAndResolveTokens(appearance, 'icon-image', feature, canonical, availableImages);
            if (appearanceIconImage) {
                const icon = bucket.getResolvedImageFromTokens(appearanceIconImage as string);
                if (icon) {
                    // Ideally we shouldn't need to compute the scaled image variant because all
                    // different sized versions of the same icon have the same number of stretchable
                    // areas, which is what we need but unfortunately, since imagePositions stores the
                    // position by the stringified sized icon we need to compute it
                    const unevaluatedIconSize = unevaluatedProperties._values['icon-size'];
                    const iconSizeData = getSizeData(bucket.zoom, unevaluatedIconSize, bucket.worldview, availableImages);
                    const imageVariant = getScaledImageVariant(icon, iconSizeData, unevaluatedIconSize, canonical, bucket.zoom, feature, bucket.pixelRatio, iconScaleFactor, bucket.worldview, availableImages);
                    const imagePosition = imagePositions.get(imageVariant.iconPrimary.toString());
                    maxQuadCount = Math.max(maxQuadCount, getIconQuadsNumber(imagePosition, hasIconTextFit));
                }
            }
        }
    }

    return maxQuadCount;
}
