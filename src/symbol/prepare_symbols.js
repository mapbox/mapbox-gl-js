// @flow
const Anchor = require('./anchor');
const getAnchors = require('./get_anchors');

const Quads = require('./quads');
const Shaping = require('./shaping');
const clipLine = require('./clip_line');
const OpacityState = require('./opacity_state');
const util = require('../util/util');
const scriptDetection = require('../util/script_detection');

const CollisionFeature = require('./collision_feature');
const findPoleOfInaccessibility = require('../util/find_pole_of_inaccessibility');
const classifyRings = require('../util/classify_rings');

const shapeText = Shaping.shapeText;
const shapeIcon = Shaping.shapeIcon;
const WritingMode = Shaping.WritingMode;
const getGlyphQuads = Quads.getGlyphQuads;
const getIconQuads = Quads.getIconQuads;

const EXTENT = require('../data/extent');
import type {SymbolFeature} from '../data/bucket/symbol_bucket';
import type {PositionedIcon} from './shaping';
import type StyleLayer from '../style/style_layer';
import type CollisionBoxArray from '../symbol/collision_box';
const SymbolBucket = require('../data/bucket/symbol_bucket');

const Point = require('@mapbox/point-geometry');

module.exports = {
    prepare
};

function prepare(bucket: SymbolBucket, stacks: any, icons: any, showCollisionBoxes: boolean) {
    bucket.createArrays();
    bucket.symbolInstances = [];

    const tileSize = 512 * bucket.overscaling;
    bucket.tilePixelRatio = EXTENT / tileSize;
    bucket.compareText = {};
    bucket.iconsNeedLinear = false;

    const layout = bucket.layers[0].layout;

    const oneEm = 24;
    const lineHeight = layout['text-line-height'] * oneEm;
    const fontstack = bucket.fontstack = layout['text-font'].join(',');
    const textAlongLine = layout['text-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line';
    const keepUpright = layout['text-keep-upright'];

    const intermediateSymbols = [];
    for (const feature of bucket.features) {

        const shapedTextOrientations = {};
        const text = feature.text;
        if (text) {
            const allowsVerticalWritingMode = scriptDetection.allowsVerticalWritingMode(text);
            const textOffset = bucket.layers[0].getLayoutValue('text-offset', {zoom: bucket.zoom}, feature.properties).map((t)=> t * oneEm);
            const spacing = bucket.layers[0].getLayoutValue('text-letter-spacing', {zoom: bucket.zoom}, feature.properties) * oneEm;
            const spacingIfAllowed = scriptDetection.allowsLetterSpacing(text) ? spacing : 0;
            const textAnchor = bucket.layers[0].getLayoutValue('text-anchor', {zoom: bucket.zoom}, feature.properties);
            const textJustify = bucket.layers[0].getLayoutValue('text-justify', {zoom: bucket.zoom}, feature.properties);
            const maxWidth = layout['symbol-placement'] !== 'line' ?
                bucket.layers[0].getLayoutValue('text-max-width', {zoom: bucket.zoom}, feature.properties) * oneEm :
                0;


            shapedTextOrientations.horizontal = shapeText(text, stacks[fontstack], maxWidth, lineHeight, textAnchor, textJustify, spacingIfAllowed, textOffset, oneEm, WritingMode.horizontal);
            if (allowsVerticalWritingMode && textAlongLine && keepUpright) {
                shapedTextOrientations.vertical = shapeText(text, stacks[fontstack], maxWidth, lineHeight, textAnchor, textJustify, spacingIfAllowed, textOffset, oneEm, WritingMode.vertical);
            }
        }

        let shapedIcon;
        if (feature.icon) {
            const image = icons[feature.icon];
            if (image) {
                shapedIcon = shapeIcon(image,
                    bucket.layers[0].getLayoutValue('icon-offset', {zoom: bucket.zoom}, feature),
                    bucket.layers[0].getLayoutValue('icon-anchor', {zoom: bucket.zoom}, feature));
                if (bucket.sdfIcons === undefined) {
                    bucket.sdfIcons = image.sdf;
                } else if (bucket.sdfIcons !== image.sdf) {
                    util.warnOnce('Style sheet warning: Cannot mix SDF and non-SDF icons in one buffer');
                }
                if (!image.isNativePixelRatio) {
                    bucket.iconsNeedLinear = true;
                } else if (layout['icon-rotate'] !== 0 || !bucket.layers[0].isLayoutValueFeatureConstant('icon-rotate')) {
                    bucket.iconsNeedLinear = true;
                }
            }
        }

        if (shapedTextOrientations.horizontal || shapedIcon) {
            addFeature(bucket, feature, intermediateSymbols, shapedTextOrientations, shapedIcon);
        }
    }

    const mayOverlap = layout['text-allow-overlap'] || layout['icon-allow-overlap'] ||
        layout['text-ignore-placement'] || layout['icon-ignore-placement'];

    // Sort symbols by their y position on the canvas so that the lower symbols
    // are drawn on top of higher symbols.
    // Don't sort symbols that won't overlap because it isn't necessary
    if (mayOverlap) {
        intermediateSymbols.sort((a, b) => {
            return (a.anchor.y - b.anchor.y) || (b.featureIndex - a.featureIndex);
        });
    }
    for (const intermediateSymbol of intermediateSymbols) {
        generateSymbolInstance(bucket, intermediateSymbol);
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
function addFeature(bucket: SymbolBucket, feature: SymbolFeature, intermediateSymbols: any, shapedTextOrientations: any, shapedIcon: PositionedIcon | void) {
    const layoutTextSize = bucket.layers[0].getLayoutValue('text-size', {zoom: bucket.zoom + 1}, feature.properties);
    const layoutIconSize = bucket.layers[0].getLayoutValue('icon-size', {zoom: bucket.zoom + 1}, feature.properties);

    const textOffset = bucket.layers[0].getLayoutValue('text-offset', {zoom: bucket.zoom }, feature.properties);
    const iconOffset = bucket.layers[0].getLayoutValue('icon-offset', {zoom: bucket.zoom }, feature.properties);

    // To reduce the number of labels that jump around when zooming we need
    // to use a text-size value that is the same for all zoom levels.
    // bucket calculates text-size at a high zoom level so that all tiles can
    // use the same value when calculating anchor positions.
    let textMaxSize = bucket.layers[0].getLayoutValue('text-size', {zoom: 18}, feature.properties);
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
        intermediateSymbols.push(addSymbol(bucket, anchor, line, shapedTextOrientations, shapedIcon, bucket.layers[0],
            addToBuffers, bucket.collisionBoxArray, feature.index, feature.sourceLayerIndex, bucket.index,
            textBoxScale, textPadding, textAlongLine, textOffset,
            iconBoxScale, iconPadding, iconAlongLine, iconOffset,
            {zoom: bucket.zoom}, feature));
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

function addTextVertices(bucket, addToBuffers, anchor, shapedText, layer, textAlongLine, globalProperties, feature, textOffset, lineArray, writingMode, deferredSymbolCreation) {
    const glyphQuads = addToBuffers ?
        getGlyphQuads(anchor, shapedText,
            layer, textAlongLine, globalProperties, feature) :
        [];

    const textSizeData = getSizeVertexData(layer,
        bucket.zoom,
        bucket.textSizeData.coveringZoomRange,
        'text-size',
        feature);

    deferredSymbolCreation.push((placedTextSymbolIndices) => {
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
    });

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
                           layer: StyleLayer,
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
                           feature: SymbolFeature) {
    const lineArray = bucket.addToLineVertexArray(anchor, line);

    let textCollisionFeature, iconCollisionFeature;

    let numIconVertices = 0;
    let numGlyphVertices = 0;
    let numVerticalGlyphVertices = 0;
    const key = shapedTextOrientations.horizontal ? shapedTextOrientations.horizontal.text : '';
    const deferredSymbolCreation = [];
    if (shapedTextOrientations.horizontal) {
        // As a collision approximation, we can use either the vertical or the horizontal version of the feature
        // We're counting on the two versions having similar dimensions
        textCollisionFeature = new CollisionFeature(collisionBoxArray, line, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedTextOrientations.horizontal, textBoxScale, textPadding, textAlongLine);
        numGlyphVertices += addTextVertices(bucket, addToBuffers, anchor, shapedTextOrientations.horizontal, layer, textAlongLine, globalProperties, feature, textOffset, lineArray, shapedTextOrientations.vertical ? WritingMode.horizontal : WritingMode.horizontalOnly, deferredSymbolCreation);

        if (shapedTextOrientations.vertical) {
            numVerticalGlyphVertices += addTextVertices(bucket, addToBuffers, anchor, shapedTextOrientations.vertical, layer, textAlongLine, globalProperties, feature, textOffset, lineArray, WritingMode.vertical, deferredSymbolCreation);
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
        iconCollisionFeature = new CollisionFeature(collisionBoxArray, line, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedIcon, iconBoxScale, iconPadding, /*align boxes to line*/false);

        numIconVertices = iconQuads.length * 4;

        const iconSizeData = getSizeVertexData(layer,
            bucket.zoom,
            bucket.iconSizeData.coveringZoomRange,
            'icon-size',
            feature);

        deferredSymbolCreation.push(() => {
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
        });
    }

    const iconBoxStartIndex = iconCollisionFeature ? iconCollisionFeature.boxStartIndex : bucket.collisionBoxArray.length;
    const iconBoxEndIndex = iconCollisionFeature ? iconCollisionFeature.boxEndIndex : bucket.collisionBoxArray.length;

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
        deferredSymbolCreation
    };
}

function generateSymbolInstance(bucket: SymbolBucket, intermediateSymbol: any) {
    const placedTextSymbolIndices = [];
    for (const deferred of intermediateSymbol.deferredSymbolCreation) {
        deferred(placedTextSymbolIndices);
    }

    if (bucket.glyphOffsetArray.length >= SymbolBucket.MAX_GLYPHS) util.warnOnce("Too many glyphs being rendered in a tile. See https://github.com/mapbox/mapbox-gl-js/issues/2907");

    const textOpacityState = new OpacityState();
    const iconOpacityState = new OpacityState();

    delete intermediateSymbol.deferredSymbolCreation;

    bucket.symbolInstances.push(util.extend(intermediateSymbol, {
        placedTextSymbolIndices,
        textOpacityState,
        iconOpacityState,
        isDuplicate: false
    }));
}

function anchorIsTooClose(bucket: any, text: any, repeatDistance: any, anchor: any) {
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

function getSizeVertexData(layer, tileZoom, stopZoomLevels, sizeProperty, feature) {
    if (
        layer.isLayoutValueZoomConstant(sizeProperty) &&
        !layer.isLayoutValueFeatureConstant(sizeProperty)
    ) {
        // source function
        return [
            10 * layer.getLayoutValue(sizeProperty, ({}: any), feature)
        ];
    } else if (
        !layer.isLayoutValueZoomConstant(sizeProperty) &&
        !layer.isLayoutValueFeatureConstant(sizeProperty)
    ) {
        // composite function
        return [
            10 * layer.getLayoutValue(sizeProperty, {zoom: stopZoomLevels[0]}, feature),
            10 * layer.getLayoutValue(sizeProperty, {zoom: stopZoomLevels[1]}, feature)
        ];
    }
    // camera function or constant
    return null;
}
