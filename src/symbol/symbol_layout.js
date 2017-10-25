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

import type {Shaping, PositionedIcon} from './shaping';
import type {SizeData} from './symbol_size';
import type CollisionBoxArray from './collision_box';
import type {SymbolFeature} from '../data/bucket/symbol_bucket';
import type {StyleImage} from '../style/style_image';
import type {StyleGlyph} from '../style/style_glyph';
import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import type {ImagePosition} from '../render/image_atlas';
import type {GlyphPosition} from '../render/glyph_atlas';

const Point = require('@mapbox/point-geometry');

module.exports = {
    performSymbolLayout
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

    const oneEm = 24;
    const lineHeight = layout['text-line-height'] * oneEm;
    const fontstack = layout['text-font'].join(',');
    const textAlongLine = layout['text-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line';
    const keepUpright = layout['text-keep-upright'];

    const glyphs = glyphMap[fontstack] || {};
    const glyphPositionMap = glyphPositions[fontstack] || {};

    for (const feature of bucket.features) {

        const shapedTextOrientations = {};
        const text = feature.text;
        if (text) {
            const allowsVerticalWritingMode = scriptDetection.allowsVerticalWritingMode(text);
            const textOffset = bucket.layers[0].getLayoutValue('text-offset', {zoom: bucket.zoom}, feature).map((t)=> t * oneEm);
            const spacing = bucket.layers[0].getLayoutValue('text-letter-spacing', {zoom: bucket.zoom}, feature) * oneEm;
            const spacingIfAllowed = scriptDetection.allowsLetterSpacing(text) ? spacing : 0;
            const textAnchor = bucket.layers[0].getLayoutValue('text-anchor', {zoom: bucket.zoom}, feature);
            const textJustify = bucket.layers[0].getLayoutValue('text-justify', {zoom: bucket.zoom}, feature);
            const maxWidth = layout['symbol-placement'] !== 'line' ?
                bucket.layers[0].getLayoutValue('text-max-width', {zoom: bucket.zoom}, feature) * oneEm :
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
                    bucket.layers[0].getLayoutValue('icon-offset', {zoom: bucket.zoom}, feature),
                    bucket.layers[0].getLayoutValue('icon-anchor', {zoom: bucket.zoom}, feature));
                if (bucket.sdfIcons === undefined) {
                    bucket.sdfIcons = image.sdf;
                } else if (bucket.sdfIcons !== image.sdf) {
                    util.warnOnce('Style sheet warning: Cannot mix SDF and non-SDF icons in one buffer');
                }
                if (image.pixelRatio !== bucket.pixelRatio) {
                    bucket.iconsNeedLinear = true;
                } else if (layout['icon-rotate'] !== 0 || !bucket.layers[0].isLayoutValueFeatureConstant('icon-rotate')) {
                    bucket.iconsNeedLinear = true;
                }
            }
        }

        if (shapedTextOrientations.horizontal || shapedIcon) {
            addFeature(bucket, feature, shapedTextOrientations, shapedIcon, glyphPositionMap);
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
                    glyphPositionMap: {[number]: GlyphPosition}) {
    const layoutTextSize = bucket.layers[0].getLayoutValue('text-size', {zoom: bucket.zoom + 1}, feature);
    const layoutIconSize = bucket.layers[0].getLayoutValue('icon-size', {zoom: bucket.zoom + 1}, feature);

    const textOffset = bucket.layers[0].getLayoutValue('text-offset', {zoom: bucket.zoom }, feature);
    const iconOffset = bucket.layers[0].getLayoutValue('icon-offset', {zoom: bucket.zoom }, feature);

    // To reduce the number of labels that jump around when zooming we need
    // to use a text-size value that is the same for all zoom levels.
    // bucket calculates text-size at a high zoom level so that all tiles can
    // use the same value when calculating anchor positions.
    let textMaxSize = bucket.layers[0].getLayoutValue('text-size', {zoom: 18}, feature);
    if (textMaxSize === undefined) {
        textMaxSize = layoutTextSize;
    }

    const layout = bucket.layers[0].layout,
        glyphSize = 24,
        fontScale = layoutTextSize / glyphSize,
        textBoxScale = bucket.tilePixelRatio * fontScale,
        textMaxBoxScale = bucket.tilePixelRatio * textMaxSize / glyphSize,
        iconBoxScale = bucket.tilePixelRatio * layoutIconSize,
        symbolMinDistance = bucket.tilePixelRatio * layout['symbol-spacing'],
        textPadding = layout['text-padding'] * bucket.tilePixelRatio,
        iconPadding = layout['icon-padding'] * bucket.tilePixelRatio,
        textMaxAngle = layout['text-max-angle'] / 180 * Math.PI,
        textAlongLine = layout['text-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line',
        iconAlongLine = layout['icon-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line',
        mayOverlap = layout['text-allow-overlap'] || layout['icon-allow-overlap'] ||
            layout['text-ignore-placement'] || layout['icon-ignore-placement'],
        symbolPlacement = layout['symbol-placement'],
        textRepeatDistance = symbolMinDistance / 2;

    const addSymbolAtAnchor = (line, anchor) => {
        const inside = !(anchor.x < 0 || anchor.x >= EXTENT || anchor.y < 0 || anchor.y >= EXTENT);

        if (!inside) return;

        // Normally symbol layers are drawn across tile boundaries. Only symbols
        // with their anchors within the tile boundaries are added to the buffers
        // to prevent symbols from being drawn twice.
        //
        // Symbols in layers with overlap are sorted in the y direction so that
        // symbols lower on the canvas are drawn on top of symbols near the top.
        // To preserve bucket order across tile boundaries these symbols can't
        // be drawn across tile boundaries. Instead they need to be included in
        // the buffers for both tiles and clipped to tile boundaries at draw time.
        const addToBuffers = inside || mayOverlap;
        bucket.symbolInstances.push(addSymbol(bucket, anchor, line, shapedTextOrientations, shapedIcon, bucket.layers[0],
            addToBuffers, bucket.collisionBoxArray, feature.index, feature.sourceLayerIndex, bucket.index,
            textBoxScale, textPadding, textAlongLine, textOffset,
            iconBoxScale, iconPadding, iconAlongLine, iconOffset,
            {zoom: bucket.zoom}, feature, glyphPositionMap));
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
                         addToBuffers: boolean,
                         anchor: Point,
                         shapedText: Shaping,
                         layer: SymbolStyleLayer,
                         textAlongLine: boolean,
                         globalProperties: Object,
                         feature: SymbolFeature,
                         textOffset: [number, number],
                         lineArray: any,
                         writingMode: number,
                         placedTextSymbolIndices: Array<number>,
                         glyphPositionMap: {[number]: GlyphPosition}) {
    const glyphQuads = addToBuffers ?
        getGlyphQuads(anchor, shapedText,
            layer, textAlongLine, globalProperties, feature, glyphPositionMap) :
        [];

    const textSizeData = getSizeVertexData(layer,
        bucket.zoom,
        bucket.textSizeData,
        'text-size',
        feature);

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
        bucket.placedGlyphArray);

    // The placedGlyphArray is used at render time in drawTileSymbols
    // These indices allow access to the array at collision detection time
    placedTextSymbolIndices.push(bucket.placedGlyphArray.length - 1);

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
                           addToBuffers: boolean,
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
                           glyphPositionMap: {[number]: GlyphPosition}) {
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
        numGlyphVertices += addTextVertices(bucket, addToBuffers, anchor, shapedTextOrientations.horizontal, layer, textAlongLine, globalProperties, feature, textOffset, lineArray, shapedTextOrientations.vertical ? WritingMode.horizontal : WritingMode.horizontalOnly, placedTextSymbolIndices, glyphPositionMap);

        if (shapedTextOrientations.vertical) {
            numVerticalGlyphVertices += addTextVertices(bucket, addToBuffers, anchor, shapedTextOrientations.vertical, layer, textAlongLine, globalProperties, feature, textOffset, lineArray, WritingMode.vertical, placedTextSymbolIndices, glyphPositionMap);
        }
    }

    const textBoxStartIndex = textCollisionFeature ? textCollisionFeature.boxStartIndex : bucket.collisionBoxArray.length;
    const textBoxEndIndex = textCollisionFeature ? textCollisionFeature.boxEndIndex : bucket.collisionBoxArray.length;

    if (shapedIcon) {
        const iconQuads = addToBuffers ?
            getIconQuads(anchor, shapedIcon, layer,
                iconAlongLine, shapedTextOrientations.horizontal,
                globalProperties, feature) :
            [];
        iconCollisionFeature = new CollisionFeature(collisionBoxArray, line, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedIcon, iconBoxScale, iconPadding, /*align boxes to line*/false, bucket.overscaling);

        numIconVertices = iconQuads.length * 4;

        const iconSizeData = getSizeVertexData(layer,
            bucket.zoom,
            bucket.iconSizeData,
            'icon-size',
            feature);

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
            bucket.placedIconArray);
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
        placedTextSymbolIndices
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

function getSizeVertexData(layer: SymbolStyleLayer, tileZoom: number, sizeData: SizeData, sizeProperty: string, feature: SymbolFeature) {
    if (sizeData.functionType === 'source') {
        return [
            10 * layer.getLayoutValue(sizeProperty, ({}: any), feature)
        ];
    } else if (sizeData.functionType === 'composite') {
        const zoomRange = sizeData.coveringZoomRange;
        return [
            10 * layer.getLayoutValue(sizeProperty, {zoom: zoomRange[0]}, feature),
            10 * layer.getLayoutValue(sizeProperty, {zoom: zoomRange[1]}, feature)
        ];
    }
    return null;
}
