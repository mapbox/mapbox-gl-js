// @flow

const Anchor = require('./anchor');
const getAnchors = require('./get_anchors');
const clipLine = require('./clip_line');
const OpacityState = require('./opacity_state');
const {shapeText, shapeIcon, WritingMode} = require('./shaping');
const {getGlyphQuads, getIconQuads} = require('./quads');
const CollisionFeature = require('./collision_feature');
const util = require('../util/util');
const scriptDetection = require('../util/script_detection');
const findPoleOfInaccessibility = require('../util/find_pole_of_inaccessibility');
const classifyRings = require('../util/classify_rings');
const EXTENT = require('../data/extent');
const SymbolBucket = require('../data/bucket/symbol_bucket');
const EvaluationParameters = require('../style/evaluation_parameters');

import type {Shaping, PositionedIcon} from './shaping';
import type {CollisionBoxArray} from '../data/array_types';
import type {SymbolFeature} from '../data/bucket/symbol_bucket';
import type {StyleImage} from '../style/style_image';
import type {StyleGlyph} from '../style/style_glyph';
import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import type {ImagePosition} from '../render/image_atlas';
import type {GlyphPosition} from '../render/glyph_atlas';
import type {PossiblyEvaluatedPropertyValue} from '../style/properties';

const Point = require('@mapbox/point-geometry');

module.exports = {
    performSymbolLayout
};

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

function performSymbolLayout(bucket: SymbolBucket,
                             glyphMap: {[string]: {[number]: ?StyleGlyph}},
                             glyphPositions: {[string]: {[number]: GlyphPosition}},
                             imageMap: {[string]: StyleImage},
                             imagePositions: {[string]: ImagePosition},
                             showCollisionBoxes: boolean) {
    bucket.createArrays();
    bucket.symbolInstances = [];

    const tileSize = 512 * bucket.overscaling;
    bucket.tilePixelRatio = EXTENT / tileSize;
    bucket.compareText = {};
    bucket.iconsNeedLinear = false;

    const layout = bucket.layers[0].layout;
    const unevaluatedLayoutValues = bucket.layers[0]._unevaluatedLayout._values;

    const sizes = {};

    if (bucket.textSizeData.functionType === 'composite') {
        const {min, max} = bucket.textSizeData.zoomRange;
        sizes.compositeTextSizes = [
            unevaluatedLayoutValues['text-size'].possiblyEvaluate(new EvaluationParameters(min)),
            unevaluatedLayoutValues['text-size'].possiblyEvaluate(new EvaluationParameters(max))
        ];
    }

    if (bucket.iconSizeData.functionType === 'composite') {
        const {min, max} = bucket.iconSizeData.zoomRange;
        sizes.compositeIconSizes = [
            unevaluatedLayoutValues['icon-size'].possiblyEvaluate(new EvaluationParameters(min)),
            unevaluatedLayoutValues['icon-size'].possiblyEvaluate(new EvaluationParameters(max))
        ];
    }

    sizes.layoutTextSize = unevaluatedLayoutValues['text-size'].possiblyEvaluate(new EvaluationParameters(bucket.zoom + 1));
    sizes.layoutIconSize = unevaluatedLayoutValues['icon-size'].possiblyEvaluate(new EvaluationParameters(bucket.zoom + 1));
    sizes.textMaxSize = unevaluatedLayoutValues['text-size'].possiblyEvaluate(new EvaluationParameters(18));

    const oneEm = 24;
    const lineHeight = layout.get('text-line-height') * oneEm;
    const textAlongLine = layout.get('text-rotation-alignment') === 'map' && layout.get('symbol-placement') === 'line';
    const keepUpright = layout.get('text-keep-upright');


    for (const feature of bucket.features) {
        const fontstack = layout.get('text-font').evaluate(feature).join(',');
        const glyphs = glyphMap[fontstack] || {};
        const glyphPositionMap = glyphPositions[fontstack] || {};

        const shapedTextOrientations = {};
        const text = feature.text;
        if (text) {
            const allowsVerticalWritingMode = scriptDetection.allowsVerticalWritingMode(text);
            const textOffset: [number, number] = (layout.get('text-offset').evaluate(feature).map((t)=> t * oneEm): any);
            const spacing = layout.get('text-letter-spacing').evaluate(feature) * oneEm;
            const spacingIfAllowed = scriptDetection.allowsLetterSpacing(text) ? spacing : 0;
            const textAnchor = layout.get('text-anchor').evaluate(feature);
            const textJustify = layout.get('text-justify').evaluate(feature);
            const maxWidth = layout.get('symbol-placement') !== 'line' ?
                layout.get('text-max-width').evaluate(feature) * oneEm :
                0;

            shapedTextOrientations.horizontal = shapeText(text, glyphs, maxWidth, lineHeight, textAnchor, textJustify, spacingIfAllowed, textOffset, oneEm, WritingMode.horizontal);
            if (allowsVerticalWritingMode && textAlongLine && keepUpright) {
                shapedTextOrientations.vertical = shapeText(text, glyphs, maxWidth, lineHeight, textAnchor, textJustify, spacingIfAllowed, textOffset, oneEm, WritingMode.vertical);
            }
        }

        let shapedIcon;
        if (feature.icon) {
            const image = imageMap[feature.icon];
            if (image) {
                shapedIcon = shapeIcon(
                    imagePositions[feature.icon],
                    layout.get('icon-offset').evaluate(feature),
                    layout.get('icon-anchor').evaluate(feature));
                if (bucket.sdfIcons === undefined) {
                    bucket.sdfIcons = image.sdf;
                } else if (bucket.sdfIcons !== image.sdf) {
                    util.warnOnce('Style sheet warning: Cannot mix SDF and non-SDF icons in one buffer');
                }
                if (image.pixelRatio !== bucket.pixelRatio) {
                    bucket.iconsNeedLinear = true;
                } else if (layout.get('icon-rotate').constantOr(1) !== 0) {
                    bucket.iconsNeedLinear = true;
                }
            }
        }

        if (shapedTextOrientations.horizontal || shapedIcon) {
            addFeature(bucket, feature, shapedTextOrientations, shapedIcon, glyphPositionMap, sizes);
        }
    }

    if (showCollisionBoxes) {
        bucket.generateCollisionDebugBuffers();
    }
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
                    glyphPositionMap: {[number]: GlyphPosition},
                    sizes: Sizes) {
    const layoutTextSize = sizes.layoutTextSize.evaluate(feature);
    const layoutIconSize = sizes.layoutIconSize.evaluate(feature);

    // To reduce the number of labels that jump around when zooming we need
    // to use a text-size value that is the same for all zoom levels.
    // bucket calculates text-size at a high zoom level so that all tiles can
    // use the same value when calculating anchor positions.
    let textMaxSize = sizes.textMaxSize.evaluate(feature);
    if (textMaxSize === undefined) {
        textMaxSize = layoutTextSize;
    }

    const layout = bucket.layers[0].layout;
    const textOffset = layout.get('text-offset').evaluate(feature);
    const iconOffset = layout.get('icon-offset').evaluate(feature);

    const glyphSize = 24,
        fontScale = layoutTextSize / glyphSize,
        textBoxScale = bucket.tilePixelRatio * fontScale,
        textMaxBoxScale = bucket.tilePixelRatio * textMaxSize / glyphSize,
        iconBoxScale = bucket.tilePixelRatio * layoutIconSize,
        symbolMinDistance = bucket.tilePixelRatio * layout.get('symbol-spacing'),
        textPadding = layout.get('text-padding') * bucket.tilePixelRatio,
        iconPadding = layout.get('icon-padding') * bucket.tilePixelRatio,
        textMaxAngle = layout.get('text-max-angle') / 180 * Math.PI,
        textAlongLine = layout.get('text-rotation-alignment') === 'map' && layout.get('symbol-placement') === 'line',
        iconAlongLine = layout.get('icon-rotation-alignment') === 'map' && layout.get('symbol-placement') === 'line',
        symbolPlacement = layout.get('symbol-placement'),
        textRepeatDistance = symbolMinDistance / 2;

    const addSymbolAtAnchor = (line, anchor) => {
        if (anchor.x < 0 || anchor.x >= EXTENT || anchor.y < 0 || anchor.y >= EXTENT) {
            // Symbol layers are drawn across tile boundaries, We filter out symbols
            // outside our tile boundaries (which may be included in vector tile buffers)
            // to prevent double-drawing symbols.
            return;
        }

        bucket.symbolInstances.push(addSymbol(bucket, anchor, line, shapedTextOrientations, shapedIcon, bucket.layers[0],
            bucket.collisionBoxArray, feature.index, feature.sourceLayerIndex, bucket.index,
            textBoxScale, textPadding, textAlongLine, textOffset,
            iconBoxScale, iconPadding, iconAlongLine, iconOffset,
            {zoom: bucket.zoom}, feature, glyphPositionMap, sizes));
    };

    if (symbolPlacement === 'line') {
        for (const line of clipLine(feature.geometry, 0, 0, EXTENT, EXTENT)) {
            const anchors = getAnchors(
                line,
                symbolMinDistance,
                textMaxAngle,
                shapedTextOrientations.vertical || shapedTextOrientations.horizontal,
                shapedIcon,
                glyphSize,
                textMaxBoxScale,
                bucket.overscaling,
                EXTENT
            );
            for (const anchor of anchors) {
                const shapedText = shapedTextOrientations.horizontal;
                if (!shapedText || !anchorIsTooClose(bucket, shapedText.text, textRepeatDistance, anchor)) {
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

function addTextVertices(bucket: SymbolBucket,
                         anchor: Point,
                         shapedText: Shaping,
                         layer: SymbolStyleLayer,
                         textAlongLine: boolean,
                         globalProperties: Object,
                         feature: SymbolFeature,
                         textOffset: [number, number],
                         lineArray: {lineStartIndex: number, lineLength: number},
                         writingMode: number,
                         placedTextSymbolIndices: Array<number>,
                         glyphPositionMap: {[number]: GlyphPosition},
                         sizes: Sizes) {
    const glyphQuads = getGlyphQuads(anchor, shapedText,
                            layer, textAlongLine, globalProperties, feature, glyphPositionMap);

    const sizeData = bucket.textSizeData;
    let textSizeData = null;

    if (sizeData.functionType === 'source') {
        textSizeData = [
            10 * layer.layout.get('text-size').evaluate(feature)
        ];
    } else if (sizeData.functionType === 'composite') {
        textSizeData = [
            10 * sizes.compositeTextSizes[0].evaluate(feature),
            10 * sizes.compositeTextSizes[1].evaluate(feature)
        ];
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
        lineArray.lineLength);

    // The placedSymbolArray is used at render time in drawTileSymbols
    // These indices allow access to the array at collision detection time
    placedTextSymbolIndices.push(bucket.text.placedSymbolArray.length - 1);

    return glyphQuads.length * 4;
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
                   globalProperties: Object,
                   feature: SymbolFeature,
                   glyphPositionMap: {[number]: GlyphPosition},
                   sizes: Sizes) {
    const lineArray = bucket.addToLineVertexArray(anchor, line);

    let textCollisionFeature, iconCollisionFeature;

    let numIconVertices = 0;
    let numGlyphVertices = 0;
    let numVerticalGlyphVertices = 0;
    const key = shapedTextOrientations.horizontal ? shapedTextOrientations.horizontal.text : '';
    const placedTextSymbolIndices = [];
    if (shapedTextOrientations.horizontal) {
        // As a collision approximation, we can use either the vertical or the horizontal version of the feature
        // We're counting on the two versions having similar dimensions
        textCollisionFeature = new CollisionFeature(collisionBoxArray, line, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedTextOrientations.horizontal, textBoxScale, textPadding, textAlongLine, bucket.overscaling);
        numGlyphVertices += addTextVertices(bucket, anchor, shapedTextOrientations.horizontal, layer, textAlongLine, globalProperties, feature, textOffset, lineArray, shapedTextOrientations.vertical ? WritingMode.horizontal : WritingMode.horizontalOnly, placedTextSymbolIndices, glyphPositionMap, sizes);

        if (shapedTextOrientations.vertical) {
            numVerticalGlyphVertices += addTextVertices(bucket, anchor, shapedTextOrientations.vertical, layer, textAlongLine, globalProperties, feature, textOffset, lineArray, WritingMode.vertical, placedTextSymbolIndices, glyphPositionMap, sizes);
        }
    }

    const textBoxStartIndex = textCollisionFeature ? textCollisionFeature.boxStartIndex : bucket.collisionBoxArray.length;
    const textBoxEndIndex = textCollisionFeature ? textCollisionFeature.boxEndIndex : bucket.collisionBoxArray.length;

    if (shapedIcon) {
        const iconQuads = getIconQuads(anchor, shapedIcon, layer,
                            iconAlongLine, shapedTextOrientations.horizontal,
                            globalProperties, feature);
        iconCollisionFeature = new CollisionFeature(collisionBoxArray, line, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedIcon, iconBoxScale, iconPadding, /*align boxes to line*/false, bucket.overscaling);

        numIconVertices = iconQuads.length * 4;

        const sizeData = bucket.iconSizeData;
        let iconSizeData = null;

        if (sizeData.functionType === 'source') {
            iconSizeData = [
                10 * layer.layout.get('icon-size').evaluate(feature)
            ];
        } else if (sizeData.functionType === 'composite') {
            iconSizeData = [
                10 * sizes.compositeIconSizes[0].evaluate(feature),
                10 * sizes.compositeIconSizes[1].evaluate(feature)
            ];
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
            lineArray.lineLength);
    }

    const iconBoxStartIndex = iconCollisionFeature ? iconCollisionFeature.boxStartIndex : bucket.collisionBoxArray.length;
    const iconBoxEndIndex = iconCollisionFeature ? iconCollisionFeature.boxEndIndex : bucket.collisionBoxArray.length;

    if (bucket.glyphOffsetArray.length >= SymbolBucket.MAX_GLYPHS) util.warnOnce("Too many glyphs being rendered in a tile. See https://github.com/mapbox/mapbox-gl-js/issues/2907");

    const textOpacityState = new OpacityState();
    const iconOpacityState = new OpacityState();

    return {
        key,
        textBoxStartIndex,
        textBoxEndIndex,
        iconBoxStartIndex,
        iconBoxEndIndex,
        textOffset,
        iconOffset,
        anchor,
        line,
        featureIndex,
        feature,
        numGlyphVertices,
        numVerticalGlyphVertices,
        numIconVertices,
        textOpacityState,
        iconOpacityState,
        isDuplicate: false,
        placedTextSymbolIndices,
        crossTileID: 0
    };
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
