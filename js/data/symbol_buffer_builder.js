'use strict';

var Point = require('point-geometry');

var BufferBuilder = require('./buffer_builder');
var ElementGroups = require('./element_groups');
var Anchor = require('../symbol/anchor');
var getAnchors = require('../symbol/get_anchors');
var resolveTokens = require('../util/token');
var Quads = require('../symbol/quads');
var Shaping = require('../symbol/shaping');
var resolveText = require('../symbol/resolve_text');
var mergeLines = require('../symbol/mergelines');
var clipLine = require('../symbol/clip_line');
var CollisionFeature = require('../symbol/collision_feature');
var util = require('../util/util');

var shapeText = Shaping.shapeText;
var shapeIcon = Shaping.shapeIcon;
var getGlyphQuads = Quads.getGlyphQuads;
var getIconQuads = Quads.getIconQuads;

module.exports = SymbolBufferBuilder;

function SymbolBufferBuilder() {
    BufferBuilder.apply(this, arguments);
}

SymbolBufferBuilder.prototype = util.inherit(BufferBuilder, {});

SymbolBufferBuilder.prototype.addFeatures = function(collisionTile, stacks, icons) {
    var tileSize = 512 * this.overscaling;
    var tileExtent = 4096;
    this.tilePixelRatio = tileExtent / tileSize;
    this.compareText = {};
    this.symbolInstances = [];

    var layout = this.layoutProperties;
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
    var fontstack = layout['text-font'].join(',');

    var geometries = [];
    for (var g = 0; g < features.length; g++) {
        geometries.push(features[g].loadGeometry());
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
                    console.warn('Style sheet warning: Cannot mix SDF and non-SDF icons in one bucket');
                }
            }
        } else {
            shapedIcon = null;
        }

        if (shapedText || shapedIcon) {
            this.addFeature(geometries[k], shapedText, shapedIcon);
        }
    }

    this.placeFeatures(collisionTile, this.buffers, this.collisionDebug);
};

SymbolBufferBuilder.prototype.addFeature = function(lines, shapedText, shapedIcon) {
    var layout = this.layoutProperties;

    var glyphSize = 24;

    var fontScale = layout['text-size'] / glyphSize,
        textBoxScale = this.tilePixelRatio * fontScale,
        textMaxBoxScale = this.tilePixelRatio * layout['text-max-size'] / glyphSize,
        iconBoxScale = this.tilePixelRatio * layout['icon-size'],
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
        lines = clipLine(lines, 0, 0, 4096, 4096);
    }

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];

        // Calculate the anchor points around which you want to place labels
        var anchors = isLine ?
            getAnchors(line, symbolMinDistance, textMaxAngle, shapedText, shapedIcon, glyphSize, textMaxBoxScale, this.overscaling) :
            [ new Anchor(line[0].x, line[0].y, 0) ];

        // For each potential label, create the placement features used to check for collisions, and the quads use for rendering.
        for (var j = 0, len = anchors.length; j < len; j++) {
            var anchor = anchors[j];

            if (shapedText && isLine) {
                if (this.anchorIsTooClose(shapedText.text, textRepeatDistance, anchor)) {
                    continue;
                }
            }

            var inside = !(anchor.x < 0 || anchor.x > 4096 || anchor.y < 0 || anchor.y > 4096);

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

            this.symbolInstances.push(new SymbolInstance(anchor, line, shapedText, shapedIcon, layout, addToBuffers,
                        textBoxScale, textPadding, textAlongLine,
                        iconBoxScale, iconPadding, iconAlongLine));
        }
    }
};

SymbolBufferBuilder.prototype.anchorIsTooClose = function(text, repeatDistance, anchor) {
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

SymbolBufferBuilder.prototype.placeFeatures = function(collisionTile, buffers, collisionDebug) {

    // Calculate which labels can be shown and when they can be shown and
    // create the bufers used for rendering.

    this.buffers = BufferBuilder._createBuffers(this.type.shaders, buffers);

    var elementGroups = this.elementGroups = {
        glyph: new ElementGroups(buffers.glyphVertex, buffers.glyphElement),
        icon: new ElementGroups(buffers.iconVertex, buffers.iconElement),
        sdfIcons: this.sdfIcons
    };

    var layout = this.layoutProperties;
    var maxScale = collisionTile.maxScale;

    elementGroups.glyph['text-size'] = layout['text-size'];
    elementGroups.icon['icon-size'] = layout['icon-size'];

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
            var aRotated = sin * a.x + cos * a.y;
            var bRotated = sin * b.x + cos * b.y;
            return bRotated - aRotated;
        });
    }

    for (var p = 0; p < this.symbolInstances.length; p++) {
        var symbolInstance = this.symbolInstances[p];
        var hasText = symbolInstance.hasText;
        var hasIcon = symbolInstance.hasIcon;

        var iconWithoutText = layout['text-optional'] || !hasText,
            textWithoutIcon = layout['icon-optional'] || !hasIcon;


        // Calculate the scales at which the text and icon can be placed without collision.

        var glyphScale = hasText && !layout['text-allow-overlap'] ?
            collisionTile.placeCollisionFeature(symbolInstance.textCollisionFeature) :
            collisionTile.minScale;

        var iconScale = hasIcon && !layout['icon-allow-overlap'] ?
            collisionTile.placeCollisionFeature(symbolInstance.iconCollisionFeature) :
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
            if (!layout['text-ignore-placement']) {
                collisionTile.insertCollisionFeature(symbolInstance.textCollisionFeature, glyphScale);
            }
            if (glyphScale <= maxScale) {
                this.addSymbols('glyph', symbolInstance.glyphQuads, glyphScale, layout['text-keep-upright'], textAlongLine, collisionTile.angle);
            }
        }

        if (hasIcon) {
            if (!layout['icon-ignore-placement']) {
                collisionTile.insertCollisionFeature(symbolInstance.iconCollisionFeature, iconScale);
            }
            if (iconScale <= maxScale) {
                this.addSymbols('icon', symbolInstance.iconQuads, iconScale, layout['icon-keep-upright'], iconAlongLine, collisionTile.angle);
            }
        }

    }

    if (collisionDebug) this.addToDebugBuffers(collisionTile);
};

SymbolBufferBuilder.prototype.addSymbols = function(shaderName, quads, scale, keepUpright, alongLine, placementAngle) {

    var elementGroups = this.elementGroups[shaderName];
    elementGroups.makeRoomFor(4 * quads.length);

    var addElement = this.addElement.bind(this, shaderName);
    var addVertex = this.addVertex.bind(this, shaderName);

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

        var index0 = addVertex([anchorPoint.x, anchorPoint.y, tl.x, tl.y, tex.x, tex.y, minZoom, maxZoom, placementZoom]);
        var index1 = addVertex([anchorPoint.x, anchorPoint.y, tr.x, tr.y, tex.x + tex.w, tex.y, minZoom, maxZoom, placementZoom]);
        var index2 = addVertex([anchorPoint.x, anchorPoint.y, bl.x, bl.y, tex.x, tex.y + tex.h, minZoom, maxZoom, placementZoom]);
        var index3 = addVertex([anchorPoint.x, anchorPoint.y, br.x, br.y, tex.x + tex.w, tex.y + tex.h, minZoom, maxZoom, placementZoom]);

        addElement([index0, index1, index2]);
        addElement([index1, index2, index3]);
    }

};

SymbolBufferBuilder.prototype.updateIcons = function(icons) {
    var iconValue = this.layoutProperties['icon-image'];
    if (!iconValue) return;

    for (var i = 0; i < this.features.length; i++) {
        var iconName = resolveTokens(this.features[i].properties, iconValue);
        if (iconName)
            icons[iconName] = true;
    }
};

SymbolBufferBuilder.prototype.updateFont = function(stacks) {
    var fontName = this.layoutProperties['text-font'],
        stack = stacks[fontName] = stacks[fontName] || {};

    this.textFeatures = resolveText(this.features, this.layoutProperties, stack);
};

SymbolBufferBuilder.prototype.addToDebugBuffers = function(collisionTile) {
    this.elementGroups.collisionBox = new ElementGroups(this.buffers.collisionBoxVertex);
    this.elementGroups.collisionBox.makeRoomFor(0);
    var angle = -collisionTile.angle;
    var yStretch = collisionTile.yStretch;

    for (var j = 0; j < this.symbolInstances.length; j++) {
        for (var i = 0; i < 2; i++) {
            var feature = this.symbolInstances[j][i === 0 ? 'textCollisionFeature' : 'iconCollisionFeature'];
            if (!feature) continue;
            var boxes = feature.boxes;

            for (var b = 0; b < boxes.length; b++) {
                var box = boxes[b];
                var anchorPoint = box.anchorPoint;

                var tl = new Point(box.x1, box.y1 * yStretch)._rotate(angle);
                var tr = new Point(box.x2, box.y1 * yStretch)._rotate(angle);
                var bl = new Point(box.x1, box.y2 * yStretch)._rotate(angle);
                var br = new Point(box.x2, box.y2 * yStretch)._rotate(angle);

                var maxZoom = Math.max(0, Math.min(25, this.zoom + Math.log(box.maxScale) / Math.LN2));
                var placementZoom = Math.max(0, Math.min(25, this.zoom + Math.log(box.placementScale) / Math.LN2));

                this.addCollisionBoxVertex(anchorPoint, tl, maxZoom, placementZoom);
                this.addCollisionBoxVertex(anchorPoint, tr, maxZoom, placementZoom);
                this.addCollisionBoxVertex(anchorPoint, tr, maxZoom, placementZoom);
                this.addCollisionBoxVertex(anchorPoint, br, maxZoom, placementZoom);
                this.addCollisionBoxVertex(anchorPoint, br, maxZoom, placementZoom);
                this.addCollisionBoxVertex(anchorPoint, bl, maxZoom, placementZoom);
                this.addCollisionBoxVertex(anchorPoint, bl, maxZoom, placementZoom);
                this.addCollisionBoxVertex(anchorPoint, tl, maxZoom, placementZoom);
            }
        }
    }
};

SymbolBufferBuilder.prototype.addSymbolVertex = function(shaderName, x, y, ox, oy, tx, ty, minzoom, maxzoom, labelminzoom) {
    return this.addVertex(shaderName, [x, y, ox, oy, tx, ty, minzoom, maxzoom, labelminzoom]);
};

function SymbolInstance(anchor, line, shapedText, shapedIcon, layout, addToBuffers,
                    textBoxScale, textPadding, textAlongLine,
                    iconBoxScale, iconPadding, iconAlongLine) {
    this.x = anchor.x;
    this.y = anchor.y;
    this.hasText = !!shapedText;
    this.hasIcon = !!shapedIcon;

    if (this.hasText) {
        this.glyphQuads = addToBuffers ? getGlyphQuads(anchor, shapedText, textBoxScale, line, layout, textAlongLine) : [];
        this.textCollisionFeature = new CollisionFeature(line, anchor, shapedText, textBoxScale, textPadding, textAlongLine);
    }

    if (this.hasIcon) {
        this.iconQuads = addToBuffers ? getIconQuads(anchor, shapedIcon, iconBoxScale, line, layout, iconAlongLine) : [];
        this.iconCollisionFeature = new CollisionFeature(line, anchor, shapedIcon, iconBoxScale, iconPadding, iconAlongLine);
    }
}
