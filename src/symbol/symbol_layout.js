// @flow

import Anchor from './anchor';

import {getAnchors, getCenterAnchor} from './get_anchors';
import clipLine from './clip_line';
import {shapeText, shapeIcon, WritingMode, fitIconToText} from './shaping';
import {getGlyphQuads, getIconQuads} from './quads';
import CollisionFeature from './collision_feature';
import {warnOnce} from '../util/util';
import {
    allowsVerticalWritingMode,
    allowsLetterSpacing
} from '../util/script_detection';
import findPoleOfInaccessibility from '../util/find_pole_of_inaccessibility';
import classifyRings from '../util/classify_rings';
import EXTENT from '../data/extent';
import SymbolBucket from '../data/bucket/symbol_bucket';
import EvaluationParameters from '../style/evaluation_parameters';
import {SIZE_PACK_FACTOR} from './symbol_size';
import ONE_EM from './one_em';
import type {CanonicalTileID} from '../source/tile_id';
import type {Shaping, PositionedIcon, TextJustify} from './shaping';
import type {CollisionBoxArray} from '../data/array_types';
import type {SymbolFeature} from '../data/bucket/symbol_bucket';
import type {StyleImage} from '../style/style_image';
import type {StyleGlyph} from '../style/style_glyph';
import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import type {ImagePosition} from '../render/image_atlas';
import type {GlyphPosition} from '../render/glyph_atlas';
import type {PossiblyEvaluatedPropertyValue} from '../style/properties';

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

export function evaluateVariableOffset(anchor: TextAnchor, offset: [number, number]) {

    function fromRadialOffset(anchor: TextAnchor, radialOffset: number) {
        let x = 0, y = 0;
        if (radialOffset < 0) radialOffset = 0; // Ignore negative offset.
        // solve for r where r^2 + r^2 = radialOffset^2
        const hypotenuse = radialOffset / Math.sqrt(2);
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
                             glyphMap: {[_: string]: {[number]: ?StyleGlyph}},
                             glyphPositions: {[_: string]: {[number]: GlyphPosition}},
                             imageMap: {[_: string]: StyleImage},
                             imagePositions: {[_: string]: ImagePosition},
                             showCollisionBoxes: boolean,
                             canonical: CanonicalTileID) {
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

    sizes.layoutTextSize = unevaluatedLayoutValues['text-size'].possiblyEvaluate(new EvaluationParameters(bucket.zoom + 1), canonical);
    sizes.layoutIconSize = unevaluatedLayoutValues['icon-size'].possiblyEvaluate(new EvaluationParameters(bucket.zoom + 1), canonical);
    sizes.textMaxSize = unevaluatedLayoutValues['text-size'].possiblyEvaluate(new EvaluationParameters(18));

    const lineHeight = layout.get('text-line-height') * ONE_EM;
    const textAlongLine = layout.get('text-rotation-alignment') === 'map' && layout.get('symbol-placement') !== 'point';
    const keepUpright = layout.get('text-keep-upright');
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
            const maxWidth = symbolPlacement === 'point' ?
                layout.get('text-max-width').evaluate(feature, {}, canonical) * ONE_EM :
                0;

            const addVerticalShapingForPointLabelIfNeeded = () => {
                if (bucket.allowVerticalPlacement && allowsVerticalWritingMode(unformattedText)) {
                    // Vertical POI label placement is meant to be used for scripts that support vertical
                    // writing mode, thus, default left justification is used. If Latin
                    // scripts would need to be supported, this should take into account other justifications.
                    shapedTextOrientations.vertical = shapeText(text, glyphMap, glyphPositions, imagePositions, fontstack, maxWidth, lineHeight, textAnchor,
                                                                'left', spacingIfAllowed, textOffset, WritingMode.vertical, true, symbolPlacement, layoutTextSize, layoutTextSizeThisZoom);
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

                addVerticalShapingForPointLabelIfNeeded();
            } else {
                if (textJustify === "auto") {
                    textJustify = getAnchorJustification(textAnchor);
                }

                // Horizontal point or line label.
                const shaping = shapeText(text, glyphMap, glyphPositions, imagePositions, fontstack, maxWidth, lineHeight, textAnchor, textJustify, spacingIfAllowed,
                                          textOffset, WritingMode.horizontal, false, symbolPlacement, layoutTextSize, layoutTextSizeThisZoom);
                if (shaping) shapedTextOrientations.horizontal[textJustify] = shaping;

                // Vertical point label (if allowVerticalPlacement is enabled).
                addVerticalShapingForPointLabelIfNeeded();

                // Verticalized line label.
                if (allowsVerticalWritingMode(unformattedText) && textAlongLine && keepUpright) {
                    shapedTextOrientations.vertical = shapeText(text, glyphMap, glyphPositions, imagePositions, fontstack, maxWidth, lineHeight, textAnchor, textJustify,
                                                                spacingIfAllowed, textOffset, WritingMode.vertical, false, symbolPlacement, layoutTextSize, layoutTextSizeThisZoom);
                }
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
        bucket.iconsInText = shapedText ? shapedText.iconsInText : false;
        if (shapedText || shapedIcon) {
            addFeature(bucket, feature, shapedTextOrientations, shapedIcon, imageMap, sizes, layoutTextSize, layoutIconSize, textOffset, isSDFIcon, canonical);
        }
    }

    if (showCollisionBoxes) {
        bucket.generateCollisionDebugBuffers();
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
                    isSDFIcon: boolean, canonical: CanonicalTileID) {
    // To reduce the number of labels that jump around when zooming we need
    // to use a text-size value that is the same for all zoom levels.
    // bucket calculates text-size at a high zoom level so that all tiles can
    // use the same value when calculating anchor positions.
    let textMaxSize = sizes.textMaxSize.evaluate(feature, {});
    if (textMaxSize === undefined) {
        textMaxSize = layoutTextSize;
    }
    const layout = bucket.layers[0].layout;
    const iconOffset = layout.get('icon-offset').evaluate(feature, {}, canonical);
    const defaultHorizontalShaping = getDefaultHorizontalShaping(shapedTextOrientations.horizontal);
    const glyphSize = 24,
        fontScale = layoutTextSize / glyphSize,
        textBoxScale = bucket.tilePixelRatio * fontScale,
        textMaxBoxScale = bucket.tilePixelRatio * textMaxSize / glyphSize,
        iconBoxScale = bucket.tilePixelRatio * layoutIconSize,
        symbolMinDistance = bucket.tilePixelRatio * layout.get('symbol-spacing'),
        textPadding = layout.get('text-padding') * bucket.tilePixelRatio,
        iconPadding = layout.get('icon-padding') * bucket.tilePixelRatio,
        textMaxAngle = layout.get('text-max-angle') / 180 * Math.PI,
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
        if (defaultHorizontalShaping) {
            shapedIcon = fitIconToText(shapedIcon, defaultHorizontalShaping, iconTextFit,
                                       layout.get('icon-text-fit-padding'), iconOffset, fontScale);
        }
    }

    const addSymbolAtAnchor = (line, anchor) => {
        if (anchor.x < 0 || anchor.x >= EXTENT || anchor.y < 0 || anchor.y >= EXTENT) {
            // Symbol layers are drawn across tile boundaries, We filter out symbols
            // outside our tile boundaries (which may be included in vector tile buffers)
            // to prevent double-drawing symbols.
            return;
        }

        addSymbol(bucket, anchor, line, shapedTextOrientations, shapedIcon, imageMap, verticallyShapedIcon, bucket.layers[0],
            bucket.collisionBoxArray, feature.index, feature.sourceLayerIndex, bucket.index,
            textBoxScale, textPadding, textAlongLine, textOffset,
            iconBoxScale, iconPadding, iconAlongLine, iconOffset,
            feature, sizes, isSDFIcon, canonical, layoutTextSize);
    };

    if (symbolPlacement === 'line') {
        for (const line of clipLine(feature.geometry, 0, 0, EXTENT, EXTENT)) {
            const anchors = getAnchors(
                line,
                symbolMinDistance,
                textMaxAngle,
                shapedTextOrientations.vertical || defaultHorizontalShaping,
                shapedIcon,
                glyphSize,
                textMaxBoxScale,
                bucket.overscaling,
                EXTENT
            );
            for (const anchor of anchors) {
                const shapedText = defaultHorizontalShaping;
                if (!shapedText || !anchorIsTooClose(bucket, shapedText.text, textRepeatDistance, anchor)) {
                    addSymbolAtAnchor(line, anchor);
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
                    shapedTextOrientations.vertical || defaultHorizontalShaping,
                    shapedIcon,
                    glyphSize,
                    textMaxBoxScale);
                if (anchor) {
                    addSymbolAtAnchor(line, anchor);
                }
            }
        }
    } else if (feature.type === 'Polygon') {
        for (const polygon of classifyRings(feature.geometry, 0)) {
            // 16 here represents 2 pixels
            const poi = findPoleOfInaccessibility(polygon, 16);
            addSymbolAtAnchor(polygon[0], new Anchor(poi.x, poi.y, 0));
        }
    } else if (feature.type === 'LineString') {
        // https://github.com/mapbox/mapbox-gl-js/issues/3808
        for (const line of feature.geometry) {
            addSymbolAtAnchor(line, new Anchor(line[0].x, line[0].y, 0));
        }
    } else if (feature.type === 'Point') {
        for (const points of feature.geometry) {
            for (const point of points) {
                addSymbolAtAnchor([point], new Anchor(point.x, point.y, 0));
            }
        }
    }
}

const MAX_GLYPH_ICON_SIZE = 255;
const MAX_PACKED_SIZE = MAX_GLYPH_ICON_SIZE * SIZE_PACK_FACTOR;
export {MAX_PACKED_SIZE};

function addTextVertices(bucket: SymbolBucket,
                         anchor: Point,
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
                         canonical: CanonicalTileID) {
    const glyphQuads = getGlyphQuads(anchor, shapedText, textOffset,
                            layer, textAlongLine, feature, imageMap, bucket.allowVerticalPlacement);

    const sizeData = bucket.textSizeData;
    let textSizeData = null;

    if (sizeData.kind === 'source') {
        textSizeData = [
            SIZE_PACK_FACTOR * layer.layout.get('text-size').evaluate(feature, {})
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
        lineArray.lineStartIndex,
        lineArray.lineLength,
        placedIconIndex,
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

/**
 * Add a single label & icon placement.
 *
 * @private
 */
function addSymbol(bucket: SymbolBucket,
                   anchor: Anchor,
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
                   textBoxScale: number,
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
                   canonical: CanonicalTileID,
                   layoutTextSize: number) {
    const lineArray = bucket.addToLineVertexArray(anchor, line);

    let textCollisionFeature, iconCollisionFeature, verticalTextCollisionFeature, verticalIconCollisionFeature;

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
        const textRotation = layer.layout.get('text-rotate').evaluate(feature, {}, canonical);
        const verticalTextRotation = textRotation + 90.0;
        const verticalShaping = shapedTextOrientations.vertical;
        verticalTextCollisionFeature = new CollisionFeature(collisionBoxArray, anchor, featureIndex, sourceLayerIndex, bucketIndex, verticalShaping, textBoxScale, textPadding, textAlongLine, verticalTextRotation);

        if (verticallyShapedIcon) {
            verticalIconCollisionFeature = new CollisionFeature(collisionBoxArray, anchor, featureIndex, sourceLayerIndex, bucketIndex, verticallyShapedIcon, iconBoxScale, iconPadding, textAlongLine, verticalTextRotation);
        }
    }

    //Place icon first, so text can have a reference to its index in the placed symbol array.
    //Text symbols can lazily shift at render-time because of variable anchor placement.
    //If the style specifies an `icon-text-fit` then the icon would have to shift along with it.
    // For more info check `updateVariableAnchors` in `draw_symbol.js` .
    if (shapedIcon) {
        const iconRotate = layer.layout.get('icon-rotate').evaluate(feature, {});
        const hasIconTextFit = layer.layout.get('icon-text-fit') !== 'none';
        const iconQuads = getIconQuads(shapedIcon, iconRotate, isSDFIcon, hasIconTextFit);
        const verticalIconQuads = verticallyShapedIcon ? getIconQuads(verticallyShapedIcon, iconRotate, isSDFIcon, hasIconTextFit) : undefined;
        iconCollisionFeature = new CollisionFeature(collisionBoxArray, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedIcon, iconBoxScale, iconPadding, /*align boxes to line*/false, iconRotate);

        numIconVertices = iconQuads.length * 4;

        const sizeData = bucket.iconSizeData;
        let iconSizeData = null;

        if (sizeData.kind === 'source') {
            iconSizeData = [
                SIZE_PACK_FACTOR * layer.layout.get('icon-size').evaluate(feature, {})
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
            anchor,
            lineArray.lineStartIndex,
            lineArray.lineLength,
            // The icon itself does not have an associated symbol since the text isnt placed yet
            -1, canonical);

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
                anchor,
                lineArray.lineStartIndex,
                lineArray.lineLength,
                // The icon itself does not have an associated symbol since the text isnt placed yet
                -1, canonical);

            verticalPlacedIconSymbolIndex = bucket.icon.placedSymbolArray.length - 1;
        }
    }

    for (const justification: any in shapedTextOrientations.horizontal) {
        const shaping = shapedTextOrientations.horizontal[justification];

        if (!textCollisionFeature) {
            key = murmur3(shaping.text);
            const textRotate = layer.layout.get('text-rotate').evaluate(feature, {}, canonical);
            // As a collision approximation, we can use either the vertical or any of the horizontal versions of the feature
            // We're counting on all versions having similar dimensions
            textCollisionFeature = new CollisionFeature(collisionBoxArray, anchor, featureIndex, sourceLayerIndex, bucketIndex, shaping, textBoxScale, textPadding, textAlongLine, textRotate);
        }

        const singleLine = shaping.positionedLines.length === 1;
        numHorizontalGlyphVertices += addTextVertices(
            bucket, anchor, shaping, imageMap, layer, textAlongLine, feature, textOffset, lineArray,
            shapedTextOrientations.vertical ? WritingMode.horizontal : WritingMode.horizontalOnly,
            singleLine ? (Object.keys(shapedTextOrientations.horizontal): any) : [justification],
            placedTextSymbolIndices, placedIconSymbolIndex, sizes, canonical);

        if (singleLine) {
            break;
        }
    }

    if (shapedTextOrientations.vertical) {
        numVerticalGlyphVertices += addTextVertices(
            bucket, anchor, shapedTextOrientations.vertical, imageMap, layer, textAlongLine, feature,
            textOffset, lineArray, WritingMode.vertical, ['vertical'], placedTextSymbolIndices, verticalPlacedIconSymbolIndex, sizes, canonical);
    }

    const textBoxStartIndex = textCollisionFeature ? textCollisionFeature.boxStartIndex : bucket.collisionBoxArray.length;
    const textBoxEndIndex = textCollisionFeature ? textCollisionFeature.boxEndIndex : bucket.collisionBoxArray.length;

    const verticalTextBoxStartIndex = verticalTextCollisionFeature ? verticalTextCollisionFeature.boxStartIndex : bucket.collisionBoxArray.length;
    const verticalTextBoxEndIndex = verticalTextCollisionFeature ? verticalTextCollisionFeature.boxEndIndex : bucket.collisionBoxArray.length;

    const iconBoxStartIndex = iconCollisionFeature ? iconCollisionFeature.boxStartIndex : bucket.collisionBoxArray.length;
    const iconBoxEndIndex = iconCollisionFeature ? iconCollisionFeature.boxEndIndex : bucket.collisionBoxArray.length;

    const verticalIconBoxStartIndex = verticalIconCollisionFeature ? verticalIconCollisionFeature.boxStartIndex : bucket.collisionBoxArray.length;
    const verticalIconBoxEndIndex = verticalIconCollisionFeature ? verticalIconCollisionFeature.boxEndIndex : bucket.collisionBoxArray.length;

    // Check if runtime collision circles should be used for any of the collision features.
    // It is enough to choose the tallest feature shape as circles are always placed on a line.
    // All measurements are in glyph metrics and later converted into pixels using proper font size "layoutTextSize"
    let collisionCircleDiameter = -1;

    const getCollisionCircleHeight = (feature: ?CollisionFeature, prevHeight: number): number => {
        if (feature && feature.circleDiameter)
            return Math.max(feature.circleDiameter, prevHeight);
        return prevHeight;
    };

    collisionCircleDiameter = getCollisionCircleHeight(textCollisionFeature, collisionCircleDiameter);
    collisionCircleDiameter = getCollisionCircleHeight(verticalTextCollisionFeature, collisionCircleDiameter);
    collisionCircleDiameter = getCollisionCircleHeight(iconCollisionFeature, collisionCircleDiameter);
    collisionCircleDiameter = getCollisionCircleHeight(verticalIconCollisionFeature, collisionCircleDiameter);
    const useRuntimeCollisionCircles = (collisionCircleDiameter > -1) ? 1 : 0;

    // Convert circle collision height into pixels
    if (useRuntimeCollisionCircles)
        collisionCircleDiameter *= layoutTextSize / ONE_EM;

    if (bucket.glyphOffsetArray.length >= SymbolBucket.MAX_GLYPHS) warnOnce(
        "Too many glyphs being rendered in a tile. See https://github.com/mapbox/mapbox-gl-js/issues/2907"
    );

    if (feature.sortKey !== undefined) {
        bucket.addToSortKeyRanges(bucket.symbolInstances.length, feature.sortKey);
    }

    bucket.symbolInstances.emplaceBack(
        anchor.x,
        anchor.y,
        placedTextSymbolIndices.right >= 0 ? placedTextSymbolIndices.right : -1,
        placedTextSymbolIndices.center >= 0 ? placedTextSymbolIndices.center : -1,
        placedTextSymbolIndices.left >= 0 ? placedTextSymbolIndices.left : -1,
        placedTextSymbolIndices.vertical || -1,
        placedIconSymbolIndex,
        verticalPlacedIconSymbolIndex,
        key,
        textBoxStartIndex,
        textBoxEndIndex,
        verticalTextBoxStartIndex,
        verticalTextBoxEndIndex,
        iconBoxStartIndex,
        iconBoxEndIndex,
        verticalIconBoxStartIndex,
        verticalIconBoxEndIndex,
        featureIndex,
        numHorizontalGlyphVertices,
        numVerticalGlyphVertices,
        numIconVertices,
        numVerticalIconVertices,
        useRuntimeCollisionCircles,
        0,
        textBoxScale,
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
