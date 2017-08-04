// @flow
const Anchor = require('./anchor');
const getAnchors = require('./get_anchors');

const Quads = require('./quads');
const Shaping = require('./shaping');
const clipLine = require('./clip_line');
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
const SymbolBucket = require('../data/bucket/symbol_bucket');

module.exports = {
    prepare: prepare
};

function prepare(bucket: any, stacks: any, icons: any, showCollisionBoxes: boolean) {
    bucket.symbolInstances = [];

    bucket.createArrays();

    const tileSize = 512 * bucket.overscaling;
    bucket.tilePixelRatio = EXTENT / tileSize;
    bucket.compareText = {};
    bucket.iconsNeedLinear = false;

    const layout = bucket.layers[0].layout;

    let horizontalAlign = 0.5,
        verticalAlign = 0.5;

    switch (layout['text-anchor']) {
    case 'right':
    case 'top-right':
    case 'bottom-right':
        horizontalAlign = 1;
        break;
    case 'left':
    case 'top-left':
    case 'bottom-left':
        horizontalAlign = 0;
        break;
    }

    switch (layout['text-anchor']) {
    case 'bottom':
    case 'bottom-right':
    case 'bottom-left':
        verticalAlign = 1;
        break;
    case 'top':
    case 'top-right':
    case 'top-left':
        verticalAlign = 0;
        break;
    }

    const justify =
        layout['text-justify'] === 'right' ? 1 :
        layout['text-justify'] === 'left' ? 0 : 0.5;

    const oneEm = 24;
    const lineHeight = layout['text-line-height'] * oneEm;
    const maxWidth = layout['symbol-placement'] !== 'line' ? layout['text-max-width'] * oneEm : 0;
    const spacing = layout['text-letter-spacing'] * oneEm;
    const fontstack = bucket.fontstack = layout['text-font'].join(',');
    const textAlongLine = layout['text-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line';
    const keepUpright = layout['text-keep-upright'];

    for (const feature of bucket.features) {

        const shapedTextOrientations = {};
        if (feature.text) {
            const allowsVerticalWritingMode = scriptDetection.allowsVerticalWritingMode(feature.text);
            const textOffset = bucket.layers[0].getLayoutValue('text-offset', {zoom: bucket.zoom}, feature.properties).map((t)=> t * oneEm);
            const spacingIfAllowed = scriptDetection.allowsLetterSpacing(feature.text) ? spacing : 0;

            shapedTextOrientations.horizontal = shapeText(feature.text, stacks[fontstack], maxWidth, lineHeight, horizontalAlign, verticalAlign, justify, spacingIfAllowed, textOffset, oneEm, WritingMode.horizontal);
            if (allowsVerticalWritingMode && textAlongLine && keepUpright) {
                shapedTextOrientations.vertical = shapeText(feature.text, stacks[fontstack], maxWidth, lineHeight, horizontalAlign, verticalAlign, justify, spacingIfAllowed, textOffset, oneEm, WritingMode.vertical);
            }
        }

        let shapedIcon;
        if (feature.icon) {
            const image = icons[feature.icon];
            if (image) {
                shapedIcon = shapeIcon(image,
                    bucket.layers[0].getLayoutValue('icon-offset', {zoom: bucket.zoom}, feature.properties));
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
            addFeature(bucket, feature, shapedTextOrientations, shapedIcon);
        }
    }

    if (showCollisionBoxes) {
        bucket.generateCollisionDebugBuffers();
    }
}


/**
 * Given a feature and its shaped text and icon data, add a 'symbol
 * instance' for each _possible_ placement of the symbol feature.
 * (SymbolBucket#place() selects which of these instances to send to the
 * renderer based on collisions with symbols in other layers from the same
 * source.)
 * @private
 */
function addFeature(bucket: any, feature: any, shapedTextOrientations: any, shapedIcon: any) {
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

    const addSymbolInstanceAtAnchor = (line, anchor) => {
        const inside = !(anchor.x < 0 || anchor.x > EXTENT || anchor.y < 0 || anchor.y > EXTENT);

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
        addSymbolInstance(bucket, anchor, line, shapedTextOrientations, shapedIcon, bucket.layers[0],
            addToBuffers, bucket.collisionBoxArray, feature.index, feature.sourceLayerIndex, bucket.index,
            textBoxScale, textPadding, textAlongLine, textOffset,
            iconBoxScale, iconPadding, iconAlongLine, iconOffset,
            {zoom: bucket.zoom}, feature.properties);
    };

    if (symbolPlacement === 'line') {
        for (const line of clipLine(feature.geometry, 0, 0, EXTENT, EXTENT)) {
            const anchors = getAnchors(
                line,
                symbolMinDistance,
                textMaxAngle,
                shapedTextOrientations.horizontal,
                shapedIcon,
                glyphSize,
                textMaxBoxScale,
                bucket.overscaling,
                EXTENT
            );
            for (const anchor of anchors) {
                const shapedText = shapedTextOrientations.horizontal;
                if (!shapedText || !anchorIsTooClose(bucket, shapedText.text, textRepeatDistance, anchor)) {
                    addSymbolInstanceAtAnchor(line, anchor);
                }
            }
        }
    } else if (feature.type === 'Polygon') {
        for (const polygon of classifyRings(feature.geometry, 0)) {
            // 16 here represents 2 pixels
            const poi = findPoleOfInaccessibility(polygon, 16);
            addSymbolInstanceAtAnchor(polygon[0], new Anchor(poi.x, poi.y, 0));
        }
    } else if (feature.type === 'LineString') {
        // https://github.com/mapbox/mapbox-gl-js/issues/3808
        for (const line of feature.geometry) {
            addSymbolInstanceAtAnchor(line, new Anchor(line[0].x, line[0].y, 0));
        }
    } else if (feature.type === 'Point') {
        for (const points of feature.geometry) {
            for (const point of points) {
                addSymbolInstanceAtAnchor([point], new Anchor(point.x, point.y, 0));
            }
        }
    }
}


function addTextVertices(bucket, addToBuffers, anchor, shapedText, layer, textAlongLine, globalProperties, featureProperties, textOffset, lineArray, writingMode) {
    const glyphQuads = addToBuffers ?
        getGlyphQuads(anchor, shapedText,
            layer, textAlongLine, globalProperties, featureProperties) :
        [];

    const textSizeData = getSizeVertexData(layer,
        bucket.zoom,
        bucket.textSizeData.coveringZoomRange,
        'text-size',
        featureProperties);
    bucket.addSymbols(
        bucket.arrays.glyph,
        glyphQuads,
        textSizeData,
        textOffset,
        textAlongLine,
        featureProperties,
        writingMode,
        anchor,
        lineArray.lineStartIndex,
        lineArray.lineLength,
        bucket.placedGlyphArray);

    return glyphQuads.length * 4;
}


/**
 * Add a single label & icon placement.
 *
 * Note that in the case of `symbol-placement: line`, the symbol instance's
 * array of glyph 'quads' may include multiple copies of each glyph,
 * corresponding to the different orientations it might take at different
 * zoom levels as the text goes around bends in the line.
 *
 * As such, each glyph quad includes a minzoom and maxzoom at which it
 * should be rendered.  bucket zoom range is calculated based on the 'layout'
 * {text,icon} size -- i.e. text/icon-size at `z: tile.zoom + 1`. If the
 * size is zoom-dependent, then the zoom range is adjusted at render time
 * to account for the difference.
 *
 * @private
 */
function addSymbolInstance(bucket: any,
                           anchor: any,
                           line: any,
                           shapedTextOrientations: any,
                           shapedIcon: any,
                           layer: any,
                           addToBuffers: any,
                           collisionBoxArray: any,
                           featureIndex: any,
                           sourceLayerIndex: any,
                           bucketIndex: any,
                           textBoxScale: any,
                           textPadding: any,
                           textAlongLine: any,
                           textOffset: any,
                           iconBoxScale: any,
                           iconPadding: any,
                           iconAlongLine: any,
                           iconOffset: any,
                           globalProperties: any,
                           featureProperties: any) {

    const lineArray = bucket.addToLineVertexArray(anchor, line);

    let textCollisionFeature, iconCollisionFeature;
    const placedTextSymbolIndices = [];

    let numIconVertices = 0;
    let numGlyphVertices = 0;
    let numVerticalGlyphVertices = 0;
    const key = shapedTextOrientations.horizontal ? shapedTextOrientations.horizontal.text : '';
    if (shapedTextOrientations.horizontal) {
        // As a collision approximation, we can use either the vetical or the horizontal version of the feature
        // We're counting on the two versions having similar dimensions
        textCollisionFeature = new CollisionFeature(collisionBoxArray, line, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedTextOrientations.horizontal, textBoxScale, textPadding, textAlongLine, false, key);
        numGlyphVertices += addTextVertices(bucket, addToBuffers, anchor, shapedTextOrientations.horizontal, layer, textAlongLine, globalProperties, featureProperties, textOffset, lineArray, shapedTextOrientations.vertical ? WritingMode.horizontal : WritingMode.horizontalOnly);

        // The placedGlyphArray is used at render time in drawTileSymbols
        // These indices allow access to the array at collision detection time
        placedTextSymbolIndices.push(bucket.placedGlyphArray.length - 1);

        if (shapedTextOrientations.vertical) {
            numVerticalGlyphVertices += addTextVertices(bucket, addToBuffers, anchor, shapedTextOrientations.vertical, layer, textAlongLine, globalProperties, featureProperties, textOffset, lineArray, WritingMode.vertical);
            placedTextSymbolIndices.push(bucket.placedGlyphArray.length - 1);
        }
    }

    const textBoxStartIndex = textCollisionFeature ? textCollisionFeature.boxStartIndex : bucket.collisionBoxArray.length;
    const textBoxEndIndex = textCollisionFeature ? textCollisionFeature.boxEndIndex : bucket.collisionBoxArray.length;

    if (shapedIcon) {
        const iconQuads = addToBuffers ?
            getIconQuads(anchor, shapedIcon, layer,
                iconAlongLine, shapedTextOrientations.horizontal,
                globalProperties, featureProperties) :
            [];
        iconCollisionFeature = new CollisionFeature(collisionBoxArray, line, anchor, featureIndex, sourceLayerIndex, bucketIndex, shapedIcon, iconBoxScale, iconPadding, iconAlongLine, true);

        numIconVertices = iconQuads.length * 4;

        const iconSizeData = getSizeVertexData(layer,
            bucket.zoom,
            bucket.iconSizeData.coveringZoomRange,
            'icon-size',
            featureProperties);

        bucket.addSymbols(
            bucket.arrays.icon,
            iconQuads,
            iconSizeData,
            iconOffset,
            iconAlongLine,
            featureProperties,
            false,
            anchor,
            lineArray.lineStartIndex,
            lineArray.lineLength,
            bucket.placedIconArray);
    }

    const iconBoxStartIndex = iconCollisionFeature ? iconCollisionFeature.boxStartIndex : bucket.collisionBoxArray.length;
    const iconBoxEndIndex = iconCollisionFeature ? iconCollisionFeature.boxEndIndex : bucket.collisionBoxArray.length;

    if (textBoxEndIndex > SymbolBucket.MAX_INSTANCES) util.warnOnce("Too many symbols being rendered in a tile. See https://github.com/mapbox/mapbox-gl-js/issues/2907");
    if (iconBoxEndIndex > SymbolBucket.MAX_INSTANCES) util.warnOnce("Too many glyphs being rendered in a tile. See https://github.com/mapbox/mapbox-gl-js/issues/2907");

    const textOpacityState = {
        opacity: 0,
        targetOpacity: 0,
        time: 0
    };

    const iconOpacityState = {
        opacity: 0,
        targetOpacity: 0,
        time: 0
    };

    bucket.symbolInstances.push({
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
        featureProperties,
        numGlyphVertices,
        numVerticalGlyphVertices,
        numIconVertices,
        placedTextSymbolIndices,
        textOpacityState,
        iconOpacityState
    });
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

function getSizeVertexData(layer, tileZoom, stopZoomLevels, sizeProperty, featureProperties) {
    if (
        layer.isLayoutValueZoomConstant(sizeProperty) &&
        !layer.isLayoutValueFeatureConstant(sizeProperty)
    ) {
        // source function
        return [
            10 * layer.getLayoutValue(sizeProperty, {}, featureProperties)
        ];
    } else if (
        !layer.isLayoutValueZoomConstant(sizeProperty) &&
        !layer.isLayoutValueFeatureConstant(sizeProperty)
    ) {
        // composite function
        return [
            10 * layer.getLayoutValue(sizeProperty, {zoom: stopZoomLevels[0]}, featureProperties),
            10 * layer.getLayoutValue(sizeProperty, {zoom: stopZoomLevels[1]}, featureProperties)
        ];
    }
    // camera function or constant
    return null;
}
