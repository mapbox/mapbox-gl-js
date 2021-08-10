// @flow

import Anchor from './anchor.js';

import {getAnchors, getCenterAnchor} from './get_anchors.js';
import clipLine from './clip_line.js';
import {shapeText, shapeIcon, WritingMode, fitIconToText} from './shaping.js';
import {getGlyphQuads, getIconQuads} from './quads.js';
import {warnOnce, degToRad} from '../util/util.js';
import {
    allowsVerticalWritingMode,
    allowsLetterSpacing
} from '../util/script_detection.js';
import findPoleOfInaccessibility from '../util/find_pole_of_inaccessibility.js';
import classifyRings from '../util/classify_rings.js';
import EXTENT from '../data/extent.js';
import SymbolBucket from '../data/bucket/symbol_bucket.js';
import EvaluationParameters from '../style/evaluation_parameters.js';
import {SIZE_PACK_FACTOR} from './symbol_size.js';
import ONE_EM from './one_em.js';
import type {CanonicalTileID} from '../source/tile_id.js';
import type {Shaping, PositionedIcon, TextJustify} from './shaping.js';
import type {CollisionBoxArray} from '../data/array_types.js';
import type {SymbolFeature} from '../data/bucket/symbol_bucket.js';
import type {StyleImage} from '../style/style_image.js';
import type {StyleGlyph} from '../style/style_glyph.js';
import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer.js';
import type {ImagePosition} from '../render/image_atlas.js';
import type {GlyphPositions} from '../render/glyph_atlas.js';
import type {PossiblyEvaluatedPropertyValue} from '../style/properties.js';
import type {Projection} from '../geo/projection/index.js';

import Point from '@mapbox/point-geometry';
import murmur3 from 'murmurhash-js';

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
type Sizes = {
    layoutTextSize: PossiblyEvaluatedPropertyValue<number>, // (3)
    layoutIconSize: PossiblyEvaluatedPropertyValue<number>, // (3)
    textMaxSize: PossiblyEvaluatedPropertyValue<number>,    // (4)
    compositeTextSizes: [PossiblyEvaluatedPropertyValue<number>, PossiblyEvaluatedPropertyValue<number>], // (5)
    compositeIconSizes: [PossiblyEvaluatedPropertyValue<number>, PossiblyEvaluatedPropertyValue<number>], // (5)
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

export function evaluateVariableOffset(anchor: TextAnchor, offset: [number, number]) {

    function fromRadialOffset(anchor: TextAnchor, radialOffset: number) {
        let x = 0, y = 0;
        if (radialOffset < 0) radialOffset = 0; // Ignore negative offset.
        // solve for r where r^2 + r^2 = radialOffset^2
        const hypotenuse = radialOffset / sqrt2;
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
            y = -radialOffset + baselineOffset;
            break;
        case 'top':
            y = radialOffset - baselineOffset;
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
            x = radialOffset;
            break;
        case 'right':
            x = -radialOffset;
            break;
        }

        return [x, y];
    }

    function fromTextOffset(anchor: TextAnchor, offsetX: number, offsetY: number) {
        let x = 0, y = 0;
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

        return [x, y];
    }

    return (offset[1] !== INVALID_TEXT_OFFSET) ? fromTextOffset(anchor, offset[0], offset[1]) : fromRadialOffset(anchor, offset[0]);
}

export function performSymbolLayout(bucket: SymbolBucket,
                             glyphMap: {[_: string]: {glyphs: {[_: number]: ?StyleGlyph}, ascender?: number, descender?: number}},
                             glyphPositions: GlyphPositions,
                             imageMap: {[_: string]: StyleImage},
                             imagePositions: {[_: string]: ImagePosition},
                             showCollisionBoxes: boolean,
                             availableImages: Array<string>,
                             canonical: CanonicalTileID,
                             tileZoom: number,
                             projection: Projection) {
    bucket.createArrays();

    const tileSize = 512 * bucket.overscaling;
    bucket.tilePixelRatio = EXTENT / tileSize;
    bucket.compareText = {};
    bucket.iconsNeedLinear = false;

    const layout = bucket.layers[0].layout;
    const unevaluatedLayoutValues = bucket.layers[0]._unevaluatedLayout._values;

    const sizes = {};

    if (bucket.textSizeData.kind === 'composite') {
        const {minZoom, maxZoom} = bucket.textSizeData;
        sizes.compositeTextSizes = [
            unevaluatedLayoutValues['text-size'].possiblyEvaluate(new EvaluationParameters(minZoom), canonical),
            unevaluatedLayoutValues['text-size'].possiblyEvaluate(new EvaluationParameters(maxZoom), canonical)
        ];
    }

    if (bucket.iconSizeData.kind === 'composite') {
        const {minZoom, maxZoom} = bucket.iconSizeData;
        sizes.compositeIconSizes = [
            unevaluatedLayoutValues['icon-size'].possiblyEvaluate(new EvaluationParameters(minZoom), canonical),
            unevaluatedLayoutValues['icon-size'].possiblyEvaluate(new EvaluationParameters(maxZoom), canonical)
        ];
    }

    sizes.layoutTextSize = unevaluatedLayoutValues['text-size'].possiblyEvaluate(new EvaluationParameters(tileZoom + 1), canonical);
    sizes.layoutIconSize = unevaluatedLayoutValues['icon-size'].possiblyEvaluate(new EvaluationParameters(tileZoom + 1), canonical);
    sizes.textMaxSize = unevaluatedLayoutValues['text-size'].possiblyEvaluate(new EvaluationParameters(18), canonical);

    const textAlongLine = layout.get('text-rotation-alignment') === 'map' && layout.get('symbol-placement') !== 'point';
    const textSize = layout.get('text-size');

    for (const feature of bucket.features) {
        const fontstack = layout.get('text-font').evaluate(feature, {}, canonical).join(',');
        const layoutTextSizeThisZoom = textSize.evaluate(feature, {}, canonical);
        const layoutTextSize = sizes.layoutTextSize.evaluate(feature, {}, canonical);
        const layoutIconSize = sizes.layoutIconSize.evaluate(feature, {}, canonical);

        const shapedTextOrientations = {
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
                    textOffset = (layout.get('text-offset').evaluate(feature, {}, canonical).map(t => t * ONE_EM): any);
                }
            }

            let textJustify = textAlongLine ?
                "center" :
                layout.get('text-justify').evaluate(feature, {}, canonical);

            const symbolPlacement = layout.get('symbol-placement');
            const isPointPlacement = symbolPlacement === 'point';
            const maxWidth = symbolPlacement === 'point' ?
                layout.get('text-max-width').evaluate(feature, {}, canonical) * ONE_EM :
                0;

            const addVerticalShapingIfNeeded = (textJustify) => {
                if (bucket.allowVerticalPlacement && allowsVerticalWritingMode(unformattedText)) {
                    // Vertical POI label placement is meant to be used for scripts that support vertical
                    // writing mode, thus, default left justification is used. If Latin
                    // scripts would need to be supported, this should take into account other justifications.
                    shapedTextOrientations.vertical = shapeText(text, glyphMap, glyphPositions, imagePositions, fontstack, maxWidth, lineHeight, textAnchor,
                                                                textJustify, spacingIfAllowed, textOffset, WritingMode.vertical, true, symbolPlacement, layoutTextSize, layoutTextSizeThisZoom);
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
                        shapedTextOrientations.horizontal[justification] = shapedTextOrientations.horizontal[0];
                    } else {
                        // If using text-variable-anchor for the layer, we use a center anchor for all shapings and apply
                        // the offsets for the anchor in the placement step.
                        const shaping = shapeText(text, glyphMap, glyphPositions, imagePositions, fontstack, maxWidth, lineHeight, 'center',
                                                  justification, spacingIfAllowed, textOffset, WritingMode.horizontal, false, symbolPlacement, layoutTextSize, layoutTextSizeThisZoom);
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
                                            textOffset, WritingMode.horizontal, false, symbolPlacement, layoutTextSize, layoutTextSizeThisZoom);
                    if (shaping) shapedTextOrientations.horizontal[textJustify] = shaping;
                }

                // Vertical point label (if allowVerticalPlacement is enabled).
                addVerticalShapingIfNeeded(symbolPlacement === 'point' ? 'left' : textJustify);
            }
        }

        let shapedIcon;
        let isSDFIcon = false;
        if (feature.icon && feature.icon.name) {
            const image = imageMap[feature.icon.name];
            if (image) {
                shapedIcon = shapeIcon(
                    imagePositions[feature.icon.name],
                    layout.get('icon-offset').evaluate(feature, {}, canonical),
                    layout.get('icon-anchor').evaluate(feature, {}, canonical));
                isSDFIcon = image.sdf;
                if (bucket.sdfIcons === undefined) {
                    bucket.sdfIcons = image.sdf;
                } else if (bucket.sdfIcons !== image.sdf) {
                    warnOnce('Style sheet warning: Cannot mix SDF and non-SDF icons in one buffer');
                }
                if (image.pixelRatio !== bucket.pixelRatio) {
                    bucket.iconsNeedLinear = true;
                } else if (layout.get('icon-rotate').constantOr(1) !== 0) {
                    bucket.iconsNeedLinear = true;
                }
            }
        }

        const shapedText = getDefaultHorizontalShaping(shapedTextOrientations.horizontal) || shapedTextOrientations.vertical;
        if (!bucket.iconsInText) {
            bucket.iconsInText = shapedText ? shapedText.iconsInText : false;
        }
        if (shapedText || shapedIcon) {
            addFeature(bucket, feature, shapedTextOrientations, shapedIcon, imageMap, sizes, layoutTextSize, layoutIconSize, textOffset, isSDFIcon, availableImages, canonical, projection);
        }
    }

    if (showCollisionBoxes) {
        bucket.generateCollisionDebugBuffers(tileZoom, bucket.collisionBoxArray);
    }
}

// Choose the justification that matches the direction of the TextAnchor
export function getAnchorJustification(anchor: TextAnchor): TextJustify  {
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
 * Given a feature and its shaped text and icon data, add a 'symbol
 * instance' for each _possible_ placement of the symbol feature.
 * (At render timePlaceSymbols#place() selects which of these instances to
 * show or hide based on collisions with symbols in other layers.)
 * @private
 */
function addFeature(bucket: SymbolBucket,
                    feature: SymbolFeature,
                    shapedTextOrientations: any,
                    shapedIcon: PositionedIcon | void,
                    imageMap: {[_: string]: StyleImage},
                    sizes: Sizes,
                    layoutTextSize: number,
                    layoutIconSize: number,
                    textOffset: [number, number],
                    isSDFIcon: boolean,
                    availableImages: Array<string>,
                    canonical: CanonicalTileID,
                    projection: Projection) {
    // To reduce the number of labels that jump around when zooming we need
    // to use a text-size value that is the same for all zoom levels.
    // bucket calculates text-size at a high zoom level so that all tiles can
    // use the same value when calculating anchor positions.
    let textMaxSize = sizes.textMaxSize.evaluate(feature, {}, canonical);
    if (textMaxSize === undefined) {
        textMaxSize = layoutTextSize;
    }
    const layout = bucket.layers[0].layout;
    const iconOffset = layout.get('icon-offset').evaluate(feature, {}, canonical);
    const defaultShaping = getDefaultHorizontalShaping(shapedTextOrientations.horizontal) || shapedTextOrientations.vertical;
    const glyphSize = ONE_EM,
        fontScale = layoutTextSize / glyphSize,
        textMaxBoxScale = bucket.tilePixelRatio * textMaxSize / glyphSize,
        iconBoxScale = bucket.tilePixelRatio * layoutIconSize,
        symbolMinDistance = bucket.tilePixelRatio * layout.get('symbol-spacing'),
        textPadding = layout.get('text-padding') * bucket.tilePixelRatio,
        iconPadding = layout.get('icon-padding') * bucket.tilePixelRatio,
        textMaxAngle = degToRad(layout.get('text-max-angle')),
        textAlongLine = layout.get('text-rotation-alignment') === 'map' && layout.get('symbol-placement') !== 'point',
        iconAlongLine = layout.get('icon-rotation-alignment') === 'map' && layout.get('symbol-placement') !== 'point',
        symbolPlacement = layout.get('symbol-placement'),
        textRepeatDistance = symbolMinDistance / 2;

    const iconTextFit = layout.get('icon-text-fit');
    let verticallyShapedIcon;

    // Adjust shaped icon size when icon-text-fit is used.
    if (shapedIcon && iconTextFit !== 'none') {
        if (bucket.allowVerticalPlacement && shapedTextOrientations.vertical) {
            verticallyShapedIcon = fitIconToText(shapedIcon, shapedTextOrientations.vertical, iconTextFit,
                layout.get('icon-text-fit-padding'), iconOffset, fontScale);
        }
        if (defaultShaping) {
            shapedIcon = fitIconToText(shapedIcon, defaultShaping, iconTextFit,
                                       layout.get('icon-text-fit-padding'), iconOffset, fontScale);
        }
    }

    const addSymbolAtAnchor = (line, anchor, canonicalId) => {
        if (anchor.x < 0 || anchor.x >= EXTENT || anchor.y < 0 || anchor.y >= EXTENT) {
            // Symbol layers are drawn across tile boundaries, We filter out symbols
            // outside our tile boundaries (which may be included in vector tile buffers)
            // to prevent double-drawing symbols.
            return;
        }

        const {x, y, z} = projection.projectTilePoint(anchor.x, anchor.y, canonicalId);
        const projectedAnchor = new Anchor(x, y, z, 0, undefined);

        addSymbol(bucket, anchor, projectedAnchor, line, shapedTextOrientations, shapedIcon, imageMap, verticallyShapedIcon, bucket.layers[0],
            bucket.collisionBoxArray, feature.index, feature.sourceLayerIndex,
            bucket.index, textPadding, textAlongLine, textOffset,
            iconBoxScale, iconPadding, iconAlongLine, iconOffset,
            feature, sizes, isSDFIcon, availableImages, canonical);
    };

    if (symbolPlacement === 'line') {
        for (const line of clipLine(feature.geometry, 0, 0, EXTENT, EXTENT)) {
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

function addTextVertices(bucket: SymbolBucket,
                         anchor: Point,
                         tileAnchor: Point,
                         shapedText: Shaping,
                         imageMap: {[_: string]: StyleImage},
                         layer: SymbolStyleLayer,
                         textAlongLine: boolean,
                         feature: SymbolFeature,
                         textOffset: [number, number],
                         lineArray: {lineStartIndex: number, lineLength: number},
                         writingMode: number,
                         placementTypes: Array<'vertical' | 'center' | 'left' | 'right'>,
                         placedTextSymbolIndices: {[_: string]: number},
                         placedIconIndex: number,
                         sizes: Sizes,
                         availableImages: Array<string>,
                         canonical: CanonicalTileID) {
    const glyphQuads = getGlyphQuads(anchor, shapedText, textOffset,
                            layer, textAlongLine, feature, imageMap, bucket.allowVerticalPlacement);

    const sizeData = bucket.textSizeData;
    let textSizeData = null;

    if (sizeData.kind === 'source') {
        textSizeData = [
            SIZE_PACK_FACTOR * layer.layout.get('text-size').evaluate(feature, {}, canonical)
        ];
        if (textSizeData[0] > MAX_PACKED_SIZE) {
            warnOnce(`${bucket.layerIds[0]}: Value for "text-size" is >= ${MAX_GLYPH_ICON_SIZE}. Reduce your "text-size".`);
        }
    } else if (sizeData.kind === 'composite') {
        textSizeData = [
            SIZE_PACK_FACTOR * sizes.compositeTextSizes[0].evaluate(feature, {}, canonical),
            SIZE_PACK_FACTOR * sizes.compositeTextSizes[1].evaluate(feature, {}, canonical)
        ];
        if (textSizeData[0] > MAX_PACKED_SIZE || textSizeData[1] > MAX_PACKED_SIZE) {
            warnOnce(`${bucket.layerIds[0]}: Value for "text-size" is >= ${MAX_GLYPH_ICON_SIZE}. Reduce your "text-size".`);
        }
    }

    bucket.addSymbols(
        bucket.text,
        glyphQuads,
        textSizeData,
        textOffset,
        textAlongLine,
        feature,
        writingMode,
        anchor,
        tileAnchor,
        lineArray.lineStartIndex,
        lineArray.lineLength,
        placedIconIndex,
        availableImages,
        canonical);

    // The placedSymbolArray is used at render time in drawTileSymbols
    // These indices allow access to the array at collision detection time
    for (const placementType of placementTypes) {
        placedTextSymbolIndices[placementType] = bucket.text.placedSymbolArray.length - 1;
    }

    return glyphQuads.length * 4;
}

function getDefaultHorizontalShaping(horizontalShaping: {[_: TextJustify]: Shaping}): Shaping | null {
    // We don't care which shaping we get because this is used for collision purposes
    // and all the justifications have the same collision box
    for (const justification: any in horizontalShaping) {
        return horizontalShaping[justification];
    }
    return null;
}

export function evaluateBoxCollisionFeature(collisionBoxArray: CollisionBoxArray,
                                     projectedAnchor: Anchor,
                                     tileAnchor: Anchor,
                                     featureIndex: number,
                                     sourceLayerIndex: number,
                                     bucketIndex: number,
                                     shaped: Object,
                                     padding: number,
                                     rotate: number,
                                     textOffset: ?[number, number]): number {
    let y1 = shaped.top;
    let y2 = shaped.bottom;
    let x1 = shaped.left;
    let x2 = shaped.right;

    const collisionPadding = shaped.collisionPadding;
    if (collisionPadding) {
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

export function evaluateCircleCollisionFeature(shaped: Object): number | null {
    if (shaped.collisionPadding) {
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
                   projectedAnchor: Anchor,
                   line: Array<Point>,
                   shapedTextOrientations: any,
                   shapedIcon: PositionedIcon | void,
                   imageMap: {[_: string]: StyleImage},
                   verticallyShapedIcon: PositionedIcon | void,
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
                   availableImages: Array<string>,
                   canonical: CanonicalTileID) {
    const lineArray = bucket.addToLineVertexArray(anchor, line);
    let textBoxIndex, iconBoxIndex, verticalTextBoxIndex, verticalIconBoxIndex;
    let textCircle, verticalTextCircle, verticalIconCircle;

    let numIconVertices = 0;
    let numVerticalIconVertices = 0;
    let numHorizontalGlyphVertices = 0;
    let numVerticalGlyphVertices = 0;
    let placedIconSymbolIndex = -1;
    let verticalPlacedIconSymbolIndex = -1;
    const placedTextSymbolIndices = {};
    let key = murmur3('');

    let textOffset0 = 0;
    let textOffset1 = 0;
    if (layer._unevaluatedLayout.getValue('text-radial-offset') === undefined) {
        [textOffset0, textOffset1] = (layer.layout.get('text-offset').evaluate(feature, {}, canonical).map(t => t * ONE_EM): any);
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
            verticalTextBoxIndex = evaluateBoxCollisionFeature(collisionBoxArray, projectedAnchor, anchor, featureIndex, sourceLayerIndex, bucketIndex, verticalShaping, textPadding, verticalTextRotation, textOffset);
            if (verticallyShapedIcon) {
                verticalIconBoxIndex = evaluateBoxCollisionFeature(collisionBoxArray, projectedAnchor, anchor, featureIndex, sourceLayerIndex, bucketIndex, verticallyShapedIcon, iconPadding, verticalTextRotation);
            }
        }
    }

    //Place icon first, so text can have a reference to its index in the placed symbol array.
    //Text symbols can lazily shift at render-time because of variable anchor placement.
    //If the style specifies an `icon-text-fit` then the icon would have to shift along with it.
    // For more info check `updateVariableAnchors` in `draw_symbol.js` .
    if (shapedIcon) {
        const iconRotate = layer.layout.get('icon-rotate').evaluate(feature, {}, canonical);
        const hasIconTextFit = layer.layout.get('icon-text-fit') !== 'none';
        const iconQuads = getIconQuads(shapedIcon, iconRotate, isSDFIcon, hasIconTextFit);
        const verticalIconQuads = verticallyShapedIcon ? getIconQuads(verticallyShapedIcon, iconRotate, isSDFIcon, hasIconTextFit) : undefined;
        iconBoxIndex = evaluateBoxCollisionFeature(collisionBoxArray, projectedAnchor, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedIcon, iconPadding, iconRotate);
        numIconVertices = iconQuads.length * 4;

        const sizeData = bucket.iconSizeData;
        let iconSizeData = null;

        if (sizeData.kind === 'source') {
            iconSizeData = [
                SIZE_PACK_FACTOR * layer.layout.get('icon-size').evaluate(feature, {}, canonical)
            ];
            if (iconSizeData[0] > MAX_PACKED_SIZE) {
                warnOnce(`${bucket.layerIds[0]}: Value for "icon-size" is >= ${MAX_GLYPH_ICON_SIZE}. Reduce your "icon-size".`);
            }
        } else if (sizeData.kind === 'composite') {
            iconSizeData = [
                SIZE_PACK_FACTOR * sizes.compositeIconSizes[0].evaluate(feature, {}, canonical),
                SIZE_PACK_FACTOR * sizes.compositeIconSizes[1].evaluate(feature, {}, canonical)
            ];
            if (iconSizeData[0] > MAX_PACKED_SIZE || iconSizeData[1] > MAX_PACKED_SIZE) {
                warnOnce(`${bucket.layerIds[0]}: Value for "icon-size" is >= ${MAX_GLYPH_ICON_SIZE}. Reduce your "icon-size".`);
            }
        }

        bucket.addSymbols(
            bucket.icon,
            iconQuads,
            iconSizeData,
            iconOffset,
            iconAlongLine,
            feature,
            false,
            projectedAnchor,
            anchor,
            lineArray.lineStartIndex,
            lineArray.lineLength,
            // The icon itself does not have an associated symbol since the text isnt placed yet
            -1,
            availableImages,
            canonical);

        placedIconSymbolIndex = bucket.icon.placedSymbolArray.length - 1;

        if (verticalIconQuads) {
            numVerticalIconVertices = verticalIconQuads.length * 4;

            bucket.addSymbols(
                bucket.icon,
                verticalIconQuads,
                iconSizeData,
                iconOffset,
                iconAlongLine,
                feature,
                WritingMode.vertical,
                projectedAnchor,
                anchor,
                lineArray.lineStartIndex,
                lineArray.lineLength,
                // The icon itself does not have an associated symbol since the text isnt placed yet
                -1,
                availableImages,
                canonical);

            verticalPlacedIconSymbolIndex = bucket.icon.placedSymbolArray.length - 1;
        }
    }

    for (const justification: any in shapedTextOrientations.horizontal) {
        const shaping = shapedTextOrientations.horizontal[justification];

        if (!textBoxIndex) {
            key = murmur3(shaping.text);
            // As a collision approximation, we can use either the vertical or any of the horizontal versions of the feature
            // We're counting on all versions having similar dimensions
            if (textAlongLine) {
                textCircle = evaluateCircleCollisionFeature(shaping);
            } else {
                const textRotate = layer.layout.get('text-rotate').evaluate(feature, {}, canonical);
                textBoxIndex = evaluateBoxCollisionFeature(collisionBoxArray, projectedAnchor, anchor, featureIndex, sourceLayerIndex, bucketIndex, shaping, textPadding, textRotate, textOffset);
            }
        }

        const singleLine = shaping.positionedLines.length === 1;
        numHorizontalGlyphVertices += addTextVertices(
            bucket, projectedAnchor, anchor, shaping, imageMap, layer, textAlongLine, feature, textOffset, lineArray,
            shapedTextOrientations.vertical ? WritingMode.horizontal : WritingMode.horizontalOnly,
            singleLine ? (Object.keys(shapedTextOrientations.horizontal): any) : [justification],
            placedTextSymbolIndices, placedIconSymbolIndex, sizes, availableImages, canonical);

        if (singleLine) {
            break;
        }
    }

    if (shapedTextOrientations.vertical) {
        numVerticalGlyphVertices += addTextVertices(
            bucket, projectedAnchor, anchor, shapedTextOrientations.vertical, imageMap, layer, textAlongLine, feature,
            textOffset, lineArray, WritingMode.vertical, ['vertical'], placedTextSymbolIndices, verticalPlacedIconSymbolIndex, sizes, availableImages, canonical);
    }

    // Check if runtime collision circles should be used for any of the collision features.
    // It is enough to choose the tallest feature shape as circles are always placed on a line.
    // All measurements are in glyph metrics and later converted into pixels using proper font size "layoutTextSize"
    let collisionCircleDiameter = -1;

    const getCollisionCircleHeight = (diameter: ?number, prevHeight: number): number => {
        return diameter ? Math.max(diameter, prevHeight) : prevHeight;
    };

    collisionCircleDiameter = getCollisionCircleHeight(textCircle, collisionCircleDiameter);
    collisionCircleDiameter = getCollisionCircleHeight(verticalTextCircle, collisionCircleDiameter);
    collisionCircleDiameter = getCollisionCircleHeight(verticalIconCircle, collisionCircleDiameter);
    const useRuntimeCollisionCircles = (collisionCircleDiameter > -1) ? 1 : 0;

    if (bucket.glyphOffsetArray.length >= SymbolBucket.MAX_GLYPHS) warnOnce(
        "Too many glyphs being rendered in a tile. See https://github.com/mapbox/mapbox-gl-js/issues/2907"
    );

    if (feature.sortKey !== undefined) {
        bucket.addToSortKeyRanges(bucket.symbolInstances.length, feature.sortKey);
    }

    bucket.symbolInstances.emplaceBack(
        projectedAnchor.x,
        projectedAnchor.y,
        projectedAnchor.z,
        anchor.x,
        anchor.y,
        placedTextSymbolIndices.right >= 0 ? placedTextSymbolIndices.right : -1,
        placedTextSymbolIndices.center >= 0 ? placedTextSymbolIndices.center : -1,
        placedTextSymbolIndices.left >= 0 ? placedTextSymbolIndices.left : -1,
        placedTextSymbolIndices.vertical  >= 0 ? placedTextSymbolIndices.vertical : -1,
        placedIconSymbolIndex,
        verticalPlacedIconSymbolIndex,
        key,
        textBoxIndex !== undefined ? textBoxIndex : bucket.collisionBoxArray.length,
        textBoxIndex !== undefined ? textBoxIndex + 1 : bucket.collisionBoxArray.length,
        verticalTextBoxIndex !== undefined ? verticalTextBoxIndex : bucket.collisionBoxArray.length,
        verticalTextBoxIndex !== undefined ? verticalTextBoxIndex + 1 : bucket.collisionBoxArray.length,
        iconBoxIndex !== undefined ? iconBoxIndex : bucket.collisionBoxArray.length,
        iconBoxIndex !== undefined ? iconBoxIndex + 1 : bucket.collisionBoxArray.length,
        verticalIconBoxIndex ? verticalIconBoxIndex : bucket.collisionBoxArray.length,
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
        collisionCircleDiameter);
}

function anchorIsTooClose(bucket: any, text: string, repeatDistance: number, anchor: Point) {
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
