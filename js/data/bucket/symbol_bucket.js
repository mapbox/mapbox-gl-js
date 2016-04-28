'use strict';

var Point = require('point-geometry');

var Bucket = require('../bucket');
var Anchor = require('../../symbol/anchor');
var getAnchors = require('../../symbol/get_anchors');
var resolveTokens = require('../../util/token');
var Quads = require('../../symbol/quads');
var Shaping = require('../../symbol/shaping');
var resolveText = require('../../symbol/resolve_text');
var mergeLines = require('../../symbol/mergelines');
var clipLine = require('../../symbol/clip_line');
var util = require('../../util/util');
var loadGeometry = require('../load_geometry');
var CollisionFeature = require('../../symbol/collision_feature');

var shapeText = Shaping.shapeText;
var shapeIcon = Shaping.shapeIcon;
var getGlyphQuads = Quads.getGlyphQuads;
var getIconQuads = Quads.getIconQuads;

var EXTENT = Bucket.EXTENT;

module.exports = SymbolBucket;

function SymbolBucket(options) {
    Bucket.apply(this, arguments);
    this.showCollisionBoxes = options.showCollisionBoxes;
    this.overscaling = options.overscaling;
    this.collisionBoxArray = options.collisionBoxArray;

    this.sdfIcons = options.sdfIcons;
    this.iconsNeedLinear = options.iconsNeedLinear;
    this.adjustedTextSize = options.adjustedTextSize;
    this.adjustedIconSize = options.adjustedIconSize;
    this.fontstack = options.fontstack;
}

SymbolBucket.prototype = util.inherit(Bucket, {});

SymbolBucket.prototype.serialize = function() {
    var serialized = Bucket.prototype.serialize.apply(this);
    serialized.sdfIcons = this.sdfIcons;
    serialized.iconsNeedLinear = this.iconsNeedLinear;
    serialized.adjustedTextSize = this.adjustedTextSize;
    serialized.adjustedIconSize = this.adjustedIconSize;
    serialized.fontstack = this.fontstack;
    return serialized;
};

var programAttributes = [{
    name: 'a_pos',
    components: 2,
    type: 'Int16'
}, {
    name: 'a_offset',
    components: 2,
    type: 'Int16'
}, {
    name: 'a_data1',
    components: 4,
    type: 'Uint8'
}, {
    name: 'a_data2',
    components: 2,
    type: 'Uint8'
}];

function addVertex(array, x, y, ox, oy, tx, ty, minzoom, maxzoom, labelminzoom) {
    return array.emplaceBack(
            // pos
            x,
            y,
            // offset
            Math.round(ox * 64), // use 1/64 pixels for placement
            Math.round(oy * 64),
            // data1
            tx / 4,                   // tex
            ty / 4,                   // tex
            (labelminzoom || 0) * 10, // labelminzoom
            0,
            // data2
            (minzoom || 0) * 10,               // minzoom
            Math.min(maxzoom || 25, 25) * 10); // minzoom
}

SymbolBucket.prototype.addCollisionBoxVertex = function(vertexArray, point, extrude, maxZoom, placementZoom) {
    return vertexArray.emplaceBack(
            // pos
            point.x,
            point.y,
            // extrude
            Math.round(extrude.x),
            Math.round(extrude.y),
            // data
            maxZoom * 10,
            placementZoom * 10);
};

SymbolBucket.prototype.programInterfaces = {

    glyph: {
        vertexBuffer: true,
        elementBuffer: true,
        layoutAttributes: programAttributes
    },

    icon: {
        vertexBuffer: true,
        elementBuffer: true,
        layoutAttributes: programAttributes
    },

    collisionBox: {
        vertexBuffer: true,

        layoutAttributes: [{
            name: 'a_pos',
            components: 2,
            type: 'Int16'
        }, {
            name: 'a_extrude',
            components: 2,
            type: 'Int16'
        }, {
            name: 'a_data',
            components: 2,
            type: 'Uint8'
        }]
    }
};

SymbolBucket.prototype.populateBuffers = function(collisionTile, stacks, icons) {

    // To reduce the number of labels that jump around when zooming we need
    // to use a text-size value that is the same for all zoom levels.
    // This calculates text-size at a high zoom level so that all tiles can
    // use the same value when calculating anchor positions.
    var zoomHistory = { lastIntegerZoom: Infinity, lastIntegerZoomTime: 0, lastZoom: 0 };
    this.adjustedTextMaxSize = this.layer.getLayoutValue('text-size', {zoom: 18, zoomHistory: zoomHistory});
    this.adjustedTextSize = this.layer.getLayoutValue('text-size', {zoom: this.zoom + 1, zoomHistory: zoomHistory});
    this.adjustedIconMaxSize = this.layer.getLayoutValue('icon-size', {zoom: 18, zoomHistory: zoomHistory});
    this.adjustedIconSize = this.layer.getLayoutValue('icon-size', {zoom: this.zoom + 1, zoomHistory: zoomHistory});

    var tileSize = 512 * this.overscaling;
    this.tilePixelRatio = EXTENT / tileSize;
    this.compareText = {};
    this.symbolInstances = [];
    this.iconsNeedLinear = false;

    var layout = this.layer.layout;
    var features = this.features;
    var textFeatures = this.textFeatures;

    var horizontalAlign = 0.5,
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

    var justify = layout['text-justify'] === 'right' ? 1 :
        layout['text-justify'] === 'left' ? 0 :
        0.5;

    var oneEm = 24;
    var lineHeight = layout['text-line-height'] * oneEm;
    var maxWidth = layout['symbol-placement'] !== 'line' ? layout['text-max-width'] * oneEm : 0;
    var spacing = layout['text-letter-spacing'] * oneEm;
    var textOffset = [layout['text-offset'][0] * oneEm, layout['text-offset'][1] * oneEm];
    var fontstack = this.fontstack = layout['text-font'].join(',');

    var geometries = [];
    for (var g = 0; g < features.length; g++) {
        geometries.push(loadGeometry(features[g]));
    }

    if (layout['symbol-placement'] === 'line') {
        // Merge adjacent lines with the same text to improve labelling.
        // It's better to place labels on one long line than on many short segments.
        var merged = mergeLines(features, textFeatures, geometries);

        geometries = merged.geometries;
        features = merged.features;
        textFeatures = merged.textFeatures;
    }

    var shapedText, shapedIcon;

    for (var k = 0; k < features.length; k++) {
        if (!geometries[k]) continue;

        if (textFeatures[k]) {
            shapedText = shapeText(textFeatures[k], stacks[fontstack], maxWidth,
                    lineHeight, horizontalAlign, verticalAlign, justify, spacing, textOffset);
        } else {
            shapedText = null;
        }

        if (layout['icon-image']) {
            var iconName = resolveTokens(features[k].properties, layout['icon-image']);
            var image = icons[iconName];
            shapedIcon = shapeIcon(image, layout);

            if (image) {
                if (this.sdfIcons === undefined) {
                    this.sdfIcons = image.sdf;
                } else if (this.sdfIcons !== image.sdf) {
                    console.warn('Style sheet warning: Cannot mix SDF and non-SDF icons in one buffer');
                }
                if (image.pixelRatio !== 1) {
                    this.iconsNeedLinear = true;
                }
            }
        } else {
            shapedIcon = null;
        }

        if (shapedText || shapedIcon) {
            this.addFeature(geometries[k], shapedText, shapedIcon, features[k].index);
        }
    }

    this.placeFeatures(collisionTile, this.showCollisionBoxes);

    this.trimArrays();
};

SymbolBucket.prototype.addFeature = function(lines, shapedText, shapedIcon, featureIndex) {
    var layout = this.layer.layout;

    var glyphSize = 24;

    var fontScale = this.adjustedTextSize / glyphSize,
        textMaxSize = this.adjustedTextMaxSize !== undefined ? this.adjustedTextMaxSize : this.adjustedTextSize,
        textBoxScale = this.tilePixelRatio * fontScale,
        textMaxBoxScale = this.tilePixelRatio * textMaxSize / glyphSize,
        iconBoxScale = this.tilePixelRatio * this.adjustedIconSize,
        symbolMinDistance = this.tilePixelRatio * layout['symbol-spacing'],
        avoidEdges = layout['symbol-avoid-edges'],
        textPadding = layout['text-padding'] * this.tilePixelRatio,
        iconPadding = layout['icon-padding'] * this.tilePixelRatio,
        textMaxAngle = layout['text-max-angle'] / 180 * Math.PI,
        textAlongLine = layout['text-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line',
        iconAlongLine = layout['icon-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line',
        mayOverlap = layout['text-allow-overlap'] || layout['icon-allow-overlap'] ||
            layout['text-ignore-placement'] || layout['icon-ignore-placement'],
        isLine = layout['symbol-placement'] === 'line',
        textRepeatDistance = symbolMinDistance / 2;

    if (isLine) {
        lines = clipLine(lines, 0, 0, EXTENT, EXTENT);
    }

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];

        // Calculate the anchor points around which you want to place labels
        var anchors;
        if (isLine) {
            anchors = getAnchors(
                line,
                symbolMinDistance,
                textMaxAngle,
                shapedText,
                shapedIcon,
                glyphSize,
                textMaxBoxScale,
                this.overscaling,
                EXTENT
            );
        } else {
            anchors = [ new Anchor(line[0].x, line[0].y, 0) ];
        }

        // For each potential label, create the placement features used to check for collisions, and the quads use for rendering.
        for (var j = 0, len = anchors.length; j < len; j++) {
            var anchor = anchors[j];

            if (shapedText && isLine) {
                if (this.anchorIsTooClose(shapedText.text, textRepeatDistance, anchor)) {
                    continue;
                }
            }

            var inside = !(anchor.x < 0 || anchor.x > EXTENT || anchor.y < 0 || anchor.y > EXTENT);

            if (avoidEdges && !inside) continue;

            // Normally symbol layers are drawn across tile boundaries. Only symbols
            // with their anchors within the tile boundaries are added to the buffers
            // to prevent symbols from being drawn twice.
            //
            // Symbols in layers with overlap are sorted in the y direction so that
            // symbols lower on the canvas are drawn on top of symbols near the top.
            // To preserve this order across tile boundaries these symbols can't
            // be drawn across tile boundaries. Instead they need to be included in
            // the buffers for both tiles and clipped to tile boundaries at draw time.
            var addToBuffers = inside || mayOverlap;

            this.symbolInstances.push(new SymbolInstance(anchor, line, shapedText, shapedIcon, layout,
                        addToBuffers, this.symbolInstances.length, this.collisionBoxArray, featureIndex, this.sourceLayerIndex, this.index,
                        textBoxScale, textPadding, textAlongLine,
                        iconBoxScale, iconPadding, iconAlongLine));
        }
    }
};

SymbolBucket.prototype.anchorIsTooClose = function(text, repeatDistance, anchor) {
    var compareText = this.compareText;
    if (!(text in compareText)) {
        compareText[text] = [];
    } else {
        var otherAnchors = compareText[text];
        for (var k = otherAnchors.length - 1; k >= 0; k--) {
            if (anchor.dist(otherAnchors[k]) < repeatDistance) {
                // If it's within repeatDistance of one anchor, stop looking
                return true;
            }
        }
    }
    // If anchor is not within repeatDistance of any other anchor, add to array
    compareText[text].push(anchor);
    return false;
};

SymbolBucket.prototype.placeFeatures = function(collisionTile, showCollisionBoxes) {
    this.recalculateStyleLayers();

    // Calculate which labels can be shown and when they can be shown and
    // create the bufers used for rendering.

    this.createArrays();

    var layout = this.layer.layout;

    var maxScale = collisionTile.maxScale;

    var textAlongLine = layout['text-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line';
    var iconAlongLine = layout['icon-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line';

    var mayOverlap = layout['text-allow-overlap'] || layout['icon-allow-overlap'] ||
        layout['text-ignore-placement'] || layout['icon-ignore-placement'];

    // Sort symbols by their y position on the canvas so that they lower symbols
    // are drawn on top of higher symbols.
    // Don't sort symbols that won't overlap because it isn't necessary and
    // because it causes more labels to pop in and out when rotating.
    if (mayOverlap) {
        var angle = collisionTile.angle;
        var sin = Math.sin(angle),
            cos = Math.cos(angle);

        this.symbolInstances.sort(function(a, b) {
            var aRotated = (sin * a.x + cos * a.y) | 0;
            var bRotated = (sin * b.x + cos * b.y) | 0;
            return (aRotated - bRotated) || (b.index - a.index);
        });
    }

    for (var p = 0; p < this.symbolInstances.length; p++) {
        var symbolInstance = this.symbolInstances[p];
        var hasText = symbolInstance.hasText;
        var hasIcon = symbolInstance.hasIcon;

        var iconWithoutText = layout['text-optional'] || !hasText,
            textWithoutIcon = layout['icon-optional'] || !hasIcon;


        // Calculate the scales at which the text and icon can be placed without collision.

        var glyphScale = hasText ?
            collisionTile.placeCollisionFeature(symbolInstance.textCollisionFeature,
                    layout['text-allow-overlap'], layout['symbol-avoid-edges']) :
            collisionTile.minScale;

        var iconScale = hasIcon ?
            collisionTile.placeCollisionFeature(symbolInstance.iconCollisionFeature,
                    layout['icon-allow-overlap'], layout['symbol-avoid-edges']) :
            collisionTile.minScale;


        // Combine the scales for icons and text.

        if (!iconWithoutText && !textWithoutIcon) {
            iconScale = glyphScale = Math.max(iconScale, glyphScale);
        } else if (!textWithoutIcon && glyphScale) {
            glyphScale = Math.max(iconScale, glyphScale);
        } else if (!iconWithoutText && iconScale) {
            iconScale = Math.max(iconScale, glyphScale);
        }


        // Insert final placement into collision tree and add glyphs/icons to buffers

        if (hasText) {
            collisionTile.insertCollisionFeature(symbolInstance.textCollisionFeature, glyphScale, layout['text-ignore-placement']);
            if (glyphScale <= maxScale) {
                this.addSymbols('glyph', symbolInstance.glyphQuads, glyphScale, layout['text-keep-upright'], textAlongLine, collisionTile.angle);
            }
        }

        if (hasIcon) {
            collisionTile.insertCollisionFeature(symbolInstance.iconCollisionFeature, iconScale, layout['icon-ignore-placement']);
            if (iconScale <= maxScale) {
                this.addSymbols('icon', symbolInstance.iconQuads, iconScale, layout['icon-keep-upright'], iconAlongLine, collisionTile.angle);
            }
        }

    }

    if (showCollisionBoxes) this.addToDebugBuffers(collisionTile);
};

SymbolBucket.prototype.addSymbols = function(programName, quads, scale, keepUpright, alongLine, placementAngle) {

    var group = this.makeRoomFor(programName, 4 * quads.length);

    var elementArray = group.layout.element;
    var vertexArray = group.layout.vertex;

    var zoom = this.zoom;
    var placementZoom = Math.max(Math.log(scale) / Math.LN2 + zoom, 0);

    for (var k = 0; k < quads.length; k++) {

        var symbol = quads[k],
            angle = symbol.angle;

        // drop upside down versions of glyphs
        var a = (angle + placementAngle + Math.PI) % (Math.PI * 2);
        if (keepUpright && alongLine && (a <= Math.PI / 2 || a > Math.PI * 3 / 2)) continue;

        var tl = symbol.tl,
            tr = symbol.tr,
            bl = symbol.bl,
            br = symbol.br,
            tex = symbol.tex,
            anchorPoint = symbol.anchorPoint,

            minZoom = Math.max(zoom + Math.log(symbol.minScale) / Math.LN2, placementZoom),
            maxZoom = Math.min(zoom + Math.log(symbol.maxScale) / Math.LN2, 25);

        if (maxZoom <= minZoom) continue;

        // Lower min zoom so that while fading out the label it can be shown outside of collision-free zoom levels
        if (minZoom === placementZoom) minZoom = 0;

        var index = addVertex(vertexArray, anchorPoint.x, anchorPoint.y, tl.x, tl.y, tex.x, tex.y, minZoom, maxZoom, placementZoom);
        addVertex(vertexArray, anchorPoint.x, anchorPoint.y, tr.x, tr.y, tex.x + tex.w, tex.y, minZoom, maxZoom, placementZoom);
        addVertex(vertexArray, anchorPoint.x, anchorPoint.y, bl.x, bl.y, tex.x, tex.y + tex.h, minZoom, maxZoom, placementZoom);
        addVertex(vertexArray, anchorPoint.x, anchorPoint.y, br.x, br.y, tex.x + tex.w, tex.y + tex.h, minZoom, maxZoom, placementZoom);

        elementArray.emplaceBack(index, index + 1, index + 2);
        elementArray.emplaceBack(index + 1, index + 2, index + 3);
    }

};

SymbolBucket.prototype.updateIcons = function(icons) {
    this.recalculateStyleLayers();
    var iconValue = this.layer.layout['icon-image'];
    if (!iconValue) return;

    for (var i = 0; i < this.features.length; i++) {
        var iconName = resolveTokens(this.features[i].properties, iconValue);
        if (iconName)
            icons[iconName] = true;
    }
};

SymbolBucket.prototype.updateFont = function(stacks) {
    this.recalculateStyleLayers();
    var fontName = this.layer.layout['text-font'],
        stack = stacks[fontName] = stacks[fontName] || {};

    this.textFeatures = resolveText(this.features, this.layer.layout, stack);
};

SymbolBucket.prototype.addToDebugBuffers = function(collisionTile) {
    var group = this.makeRoomFor('collisionBox', 0);
    var vertexArray = group.layout.vertex;
    var angle = -collisionTile.angle;
    var yStretch = collisionTile.yStretch;

    for (var j = 0; j < this.symbolInstances.length; j++) {
        for (var i = 0; i < 2; i++) {
            var feature = this.symbolInstances[j][i === 0 ? 'textCollisionFeature' : 'iconCollisionFeature'];
            if (!feature) continue;

            for (var b = feature.boxStartIndex; b < feature.boxEndIndex; b++) {
                var box = this.collisionBoxArray.get(b);
                var anchorPoint = box.anchorPoint;

                var tl = new Point(box.x1, box.y1 * yStretch)._rotate(angle);
                var tr = new Point(box.x2, box.y1 * yStretch)._rotate(angle);
                var bl = new Point(box.x1, box.y2 * yStretch)._rotate(angle);
                var br = new Point(box.x2, box.y2 * yStretch)._rotate(angle);

                var maxZoom = Math.max(0, Math.min(25, this.zoom + Math.log(box.maxScale) / Math.LN2));
                var placementZoom = Math.max(0, Math.min(25, this.zoom + Math.log(box.placementScale) / Math.LN2));

                this.addCollisionBoxVertex(vertexArray, anchorPoint, tl, maxZoom, placementZoom);
                this.addCollisionBoxVertex(vertexArray, anchorPoint, tr, maxZoom, placementZoom);
                this.addCollisionBoxVertex(vertexArray, anchorPoint, tr, maxZoom, placementZoom);
                this.addCollisionBoxVertex(vertexArray, anchorPoint, br, maxZoom, placementZoom);
                this.addCollisionBoxVertex(vertexArray, anchorPoint, br, maxZoom, placementZoom);
                this.addCollisionBoxVertex(vertexArray, anchorPoint, bl, maxZoom, placementZoom);
                this.addCollisionBoxVertex(vertexArray, anchorPoint, bl, maxZoom, placementZoom);
                this.addCollisionBoxVertex(vertexArray, anchorPoint, tl, maxZoom, placementZoom);
            }
        }
    }
};

function SymbolInstance(anchor, line, shapedText, shapedIcon, layout, addToBuffers, index, collisionBoxArray, featureIndex, sourceLayerIndex, bucketIndex,
                        textBoxScale, textPadding, textAlongLine,
                        iconBoxScale, iconPadding, iconAlongLine) {

    this.x = anchor.x;
    this.y = anchor.y;
    this.index = index;
    this.hasText = !!shapedText;
    this.hasIcon = !!shapedIcon;

    if (this.hasText) {
        this.glyphQuads = addToBuffers ? getGlyphQuads(anchor, shapedText, textBoxScale, line, layout, textAlongLine) : [];
        this.textCollisionFeature = new CollisionFeature(collisionBoxArray, line, anchor, featureIndex, sourceLayerIndex, bucketIndex,
                shapedText, textBoxScale, textPadding, textAlongLine, false);
    }

    if (this.hasIcon) {
        this.iconQuads = addToBuffers ? getIconQuads(anchor, shapedIcon, iconBoxScale, line, layout, iconAlongLine) : [];
        this.iconCollisionFeature = new CollisionFeature(collisionBoxArray, line, anchor, featureIndex, sourceLayerIndex, bucketIndex,
                shapedIcon, iconBoxScale, iconPadding, iconAlongLine, true);
    }
}
