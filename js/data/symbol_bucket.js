'use strict';

var ElementGroups = require('./element_groups');
var Anchor = require('../symbol/anchor');
var getAnchors = require('../symbol/get_anchors');
var resolveTokens = require('../util/token');
var Quads = require('../symbol/quads');
var Shaping = require('../symbol/shaping');
var resolveText = require('../symbol/resolve_text');
var resolveIcons = require('../symbol/resolve_icons');
var mergeLines = require('../symbol/mergelines');
var shapeText = Shaping.shapeText;
var shapeIcon = Shaping.shapeIcon;
var getGlyphQuads = Quads.getGlyphQuads;
var getIconQuads = Quads.getIconQuads;
var clipLine = require('../symbol/clip_line');
var Point = require('point-geometry');
var SymbolLayoutProperties = require('../style/layout_properties').symbol;

var CollisionFeature = require('../symbol/collision_feature');

module.exports = SymbolBucket;

function SymbolBucket(buffers, layoutDeclarations, paintDeclarations, overscaling, zoom, collisionDebug) {

    this.partiallyEvaluatedScales = {};
    var offsets = this.offsets = {
        text: {},
        icon: {}
    };
    var textItemSize = 16;
    var iconItemSize = 16;

    var textColor = paintDeclarations['text-color'];
    if (textColor && !textColor.calculate.isFeatureConstant) {
        offsets.text.color = textItemSize;
        textItemSize += 4;
        this.partiallyEvaluatedScales.textColor = textColor.calculate(zoom);
    }

    var textHaloColor = paintDeclarations['text-halo-color'];
    if (textHaloColor && !textHaloColor.calculate.isFeatureConstant) {
        offsets.text.haloColor = textItemSize;
        textItemSize += 4;
        this.partiallyEvaluatedScales.textHaloColor = textHaloColor.calculate(zoom);
    }

    var iconColor = paintDeclarations['icon-color'];
    if (iconColor && !iconColor.calculate.isFeatureConstant) {
        offsets.icon.color = iconItemSize;
        iconItemSize += 4;
        this.partiallyEvaluatedScales.iconColor = iconColor.calculate(zoom);
    }

    var iconHaloColor = paintDeclarations['icon-halo-color'];
    if (iconColor && !iconColor.calculate.isFeatureConstant) {
        offsets.icon.haloColor = iconItemSize;
        iconItemSize += 4;
        this.partiallyEvaluatedScales.iconHaloColor = iconHaloColor.calculate(zoom);
    }

    var iconOpacity = paintDeclarations['icon-opacity'];
    if (iconOpacity && !iconOpacity.calculate.isFeatureConstant) {
        offsets.icon.opacity = iconItemSize;
        iconItemSize += 4;
        this.partiallyEvaluatedScales.iconOpacity = iconOpacity.calculate(zoom);
    }

    offsets.textItemSize = textItemSize;
    offsets.iconItemSize = iconItemSize;

    this.buffers = buffers;
    this.layoutDeclarations = layoutDeclarations;
    this.overscaling = overscaling;
    this.zoom = zoom;
    this.collisionDebug = collisionDebug;

    var tileSize = 512 * overscaling;
    var tileExtent = 4096;
    this.tilePixelRatio = tileExtent / tileSize;

    this.symbolInstances = [];

}

SymbolBucket.prototype.needsPlacement = true;

SymbolBucket.prototype.addFeatures = function(collisionTile) {
    var featureLayoutProperties = this.featureLayoutProperties;
    var features = this.features;
    var textFeatures = this.textFeatures;

    var geometries = [];
    for (var g = 0; g < features.length; g++) {
        geometries.push(features[g].loadGeometry());
    }

    // TODO don't base the decision to merge on the first feature's properties
    if (featureLayoutProperties.length && featureLayoutProperties[0]['symbol-placement'] === 'line') {
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

        var layout = featureLayoutProperties[k];

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
        var fontstack = layout['text-font'];

        if (textFeatures[k]) {
            shapedText = shapeText(textFeatures[k], this.stacks[fontstack], maxWidth,
                    lineHeight, horizontalAlign, verticalAlign, justify, spacing, textOffset);
        } else {
            shapedText = null;
        }

        if (layout['icon-image']) {
            var iconName = resolveTokens(features[k].properties, layout['icon-image']);
            var image = this.icons[iconName];
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
            this.addFeature(geometries[k], shapedText, shapedIcon, layout, features[k].properties);
        }
    }

    this.placeFeatures(collisionTile, this.buffers, this.collisionDebug);
};

SymbolBucket.prototype.addFeature = function(lines, shapedText, shapedIcon, layout, properties) {
    var glyphSize = 24;

    var fontScale = layout['text-max-size'] / glyphSize,
        textBoxScale = this.tilePixelRatio * fontScale,
        iconBoxScale = this.tilePixelRatio * layout['icon-max-size'],
        symbolMinDistance = this.tilePixelRatio * layout['symbol-spacing'],
        avoidEdges = layout['symbol-avoid-edges'],
        textPadding = layout['text-padding'] * this.tilePixelRatio,
        iconPadding = layout['icon-padding'] * this.tilePixelRatio,
        textMaxAngle = layout['text-max-angle'] / 180 * Math.PI,
        textAlongLine = layout['text-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line',
        iconAlongLine = layout['icon-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line',
        mayOverlap = layout['text-allow-overlap'] || layout['icon-allow-overlap'] ||
            layout['text-ignore-placement'] || layout['icon-ignore-placement'];

    if (layout['symbol-placement'] === 'line') {
        lines = clipLine(lines, 0, 0, 4096, 4096);
    }

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];

        // Calculate the anchor points around which you want to place labels
        var anchors = layout['symbol-placement'] === 'line' ?
            getAnchors(line, symbolMinDistance, textMaxAngle, shapedText, glyphSize, textBoxScale, this.overscaling) :
            [ new Anchor(line[0].x, line[0].y, 0) ];

        // For each potential label, create the placement features used to check for collisions, and the quads use for rendering.
        for (var j = 0, len = anchors.length; j < len; j++) {
            var anchor = anchors[j];

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

            this.symbolInstances.push(new SymbolInstance(anchor, line, shapedText, shapedIcon, layout, properties, addToBuffers,
                        textBoxScale, textPadding, textAlongLine,
                        iconBoxScale, iconPadding, iconAlongLine));
        }
    }
};

SymbolBucket.prototype.placeFeatures = function(collisionTile, buffers, collisionDebug) {

    // Calculate which labels can be shown and when they can be shown and
    // create the bufers used for rendering.

    this.buffers = buffers;

    var offsets = this.offsets;

    buffers.glyphVertex.itemSize = offsets.textItemSize;
    buffers.iconVertex.itemSize = offsets.iconItemSize;
    buffers.glyphVertex.alignInitialPos();
    buffers.iconVertex.alignInitialPos();

    var elementGroups = this.elementGroups = {
        text: new ElementGroups(buffers.glyphVertex, buffers.glyphElement),
        icon: new ElementGroups(buffers.iconVertex, buffers.iconElement),
        sdfIcons: this.sdfIcons
    };

    elementGroups.text.offsets = offsets.text;
    elementGroups.icon.offsets = offsets.icon;
    elementGroups.text.itemSize = offsets.textItemSize;
    elementGroups.icon.itemSize = offsets.iconItemSize;


    var featureLayoutProperties = this.featureLayoutProperties;
    var maxScale = collisionTile.maxScale;

    var sharedLayout = featureLayoutProperties.length ? featureLayoutProperties[0] : {};
    var mayOverlap = sharedLayout['text-allow-overlap'] || sharedLayout['icon-allow-overlap'] ||
        sharedLayout['text-ignore-placement'] || sharedLayout['icon-ignore-placement'];

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

        var layout = symbolInstance.layout;
        var textAlongLine = layout['text-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line';
        var iconAlongLine = layout['icon-rotation-alignment'] === 'map' && layout['symbol-placement'] === 'line';

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


        var index;
        // Insert final placement into collision tree and add glyphs/icons to buffers

        if (hasText) {
            if (!layout['text-ignore-placement']) {
                collisionTile.insertCollisionFeature(symbolInstance.textCollisionFeature, glyphScale);
            }
            if (glyphScale <= maxScale) {
                var glyphVertex = buffers.glyphVertex;
                var textFeatureStartIndex = glyphVertex.index;

                this.addSymbols(glyphVertex, buffers.glyphElement, elementGroups.text,
                        symbolInstance.glyphQuads, glyphScale, layout['text-keep-upright'], textAlongLine,
                        collisionTile.angle);

                var textFeatureEndIndex = glyphVertex.index;

                var colorOffset = offsets.text.color;
                var haloColorOffset = offsets.text.haloColor;

                if (colorOffset !== undefined) {
                    var color = this.partiallyEvaluatedScales.textColor(symbolInstance.properties);
                    color = [color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255];
                    for (index = textFeatureStartIndex; index < textFeatureEndIndex; index++) {
                        glyphVertex.addColor(index, colorOffset, color);
                    }
                }

                if (haloColorOffset !== undefined) {
                    var haloColor = this.partiallyEvaluatedScales.textHaloColor(symbolInstance.properties);
                    haloColor = [haloColor[0] * 255, haloColor[1] * 255, haloColor[2] * 255, haloColor[3] * 255];
                    for (index = textFeatureStartIndex; index < textFeatureEndIndex; index++) {
                        glyphVertex.addColor(index, haloColorOffset, haloColor);
                    }
                }
            }
        }

        if (hasIcon) {
            if (!layout['icon-ignore-placement']) {
                collisionTile.insertCollisionFeature(symbolInstance.iconCollisionFeature, iconScale);
            }
            if (iconScale <= maxScale) {
                var iconVertex = buffers.iconVertex;
                var iconFeatureStartIndex = iconVertex.index;

                this.addSymbols(iconVertex, buffers.iconElement, elementGroups.icon,
                        symbolInstance.iconQuads, iconScale, layout['icon-keep-upright'], iconAlongLine,
                        collisionTile.angle);

                var iconFeatureEndIndex = iconVertex.index;

                var iconColorOffset = offsets.icon.color;
                var iconHaloColorOffset = offsets.icon.haloColor;
                var iconOpacityOffset = offsets.icon.opacity;

                if (iconColorOffset !== undefined) {
                    var iconColor = this.partiallyEvaluatedScales.iconColor(symbolInstance.properties);
                    iconColor = [iconColor[0] * 255, iconColor[1] * 255, iconColor[2] * 255, iconColor[3] * 255];
                    for (index = iconFeatureStartIndex; index < iconFeatureEndIndex; index++) {
                        iconVertex.addColor(index, iconColorOffset, iconColor);
                    }
                }

                if (iconHaloColorOffset !== undefined) {
                    var iconHaloColor = this.partiallyEvaluatedScales.iconHaloColor(symbolInstance.properties);
                    iconHaloColor = [iconHaloColor[0] * 255, iconHaloColor[1] * 255, iconHaloColor[2] * 255, iconHaloColor[3] * 255];
                    for (index = iconFeatureStartIndex; index < iconFeatureEndIndex; index++) {
                        iconVertex.addColor(index, iconHaloColorOffset, iconHaloColor);
                    }
                }

                if (iconOpacityOffset !== undefined) {
                    var iconOpacity = this.partiallyEvaluatedScales.iconOpacity(symbolInstance.properties);
                    iconOpacity = [iconOpacity[0] * 255, iconOpacity[1] * 255, iconOpacity[2] * 255, iconOpacity[3] * 255];
                    for (index = iconFeatureStartIndex; index < iconFeatureEndIndex; index++) {
                        iconVertex.addOpacity(index, iconOpacityOffset, iconOpacity);
                    }
                }
            }
        }

    }

    if (collisionDebug) this.addToDebugBuffers(collisionTile);
};

SymbolBucket.prototype.addSymbols = function(vertex, element, elementGroups, quads, scale, keepUpright, alongLine, placementAngle) {

    elementGroups.makeRoomFor(4 * quads.length);
    var elementGroup = elementGroups.current;

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

        var triangleIndex = vertex.index - elementGroup.vertexStartIndex;

        vertex.add(anchorPoint.x, anchorPoint.y, tl.x, tl.y, tex.x, tex.y, minZoom, maxZoom, placementZoom);
        vertex.add(anchorPoint.x, anchorPoint.y, tr.x, tr.y, tex.x + tex.w, tex.y, minZoom, maxZoom, placementZoom);
        vertex.add(anchorPoint.x, anchorPoint.y, bl.x, bl.y, tex.x, tex.y + tex.h, minZoom, maxZoom, placementZoom);
        vertex.add(anchorPoint.x, anchorPoint.y, br.x, br.y, tex.x + tex.w, tex.y + tex.h, minZoom, maxZoom, placementZoom);
        elementGroup.vertexLength += 4;

        element.add(triangleIndex, triangleIndex + 1, triangleIndex + 2);
        element.add(triangleIndex + 1, triangleIndex + 2, triangleIndex + 3);
        elementGroup.elementLength += 2;
    }

};

SymbolBucket.prototype.calculateLayoutProperties = function() {
    var layoutDeclarations = this.layoutDeclarations;
    var featureLayoutProperties = this.featureLayoutProperties = [];
    var features = this.features;
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        var layout = {};
        for (var k in layoutDeclarations) {
            layout[k] = layoutDeclarations[k].calculate(this.zoom)(feature.properties);
        }
        featureLayoutProperties.push(new SymbolLayoutProperties(layout));
    }
};

SymbolBucket.prototype.getDependencies = function(tile, actor, callback) {
    this.calculateLayoutProperties();

    var firstdone = false;
    this.getTextDependencies(tile, actor, done);
    this.getIconDependencies(tile, actor, done);
    function done(err) {
        if (err || firstdone) return callback(err);
        firstdone = true;
    }
};

SymbolBucket.prototype.getIconDependencies = function(tile, actor, callback) {
    if (this.layoutDeclarations['icon-image']) {
        var features = this.features;
        var icons = resolveIcons(features, this.featureLayoutProperties);

        if (icons.length) {
            actor.send('get icons', { icons: icons }, setIcons.bind(this));
        } else {
            callback();
        }
    } else {
        callback();
    }

    function setIcons(err, newicons) {
        if (err) return callback(err);
        this.icons = newicons;
        callback();
    }
};

SymbolBucket.prototype.getTextDependencies = function(tile, actor, callback) {
    var features = this.features;

    var stacks = this.stacks = tile.stacks;
    var data = resolveText(features, this.featureLayoutProperties, stacks);
    this.textFeatures = data.textFeatures;

    actor.send('get glyphs', {
        uid: tile.uid,
        missing: data.codepoints
    }, function(err, newstacks) {
        if (err) return callback(err);

        for (var fontstack in newstacks) {
            var newstack = newstacks[fontstack];
            var stack = stacks[fontstack];
            for (var codepoint in newstack) {
                stack[codepoint] = newstack[codepoint];
            }
        }

        callback();
    });
};

SymbolBucket.prototype.addToDebugBuffers = function(collisionTile) {

    this.elementGroups.collisionBox = new ElementGroups(this.buffers.collisionBoxVertex);
    this.elementGroups.collisionBox.makeRoomFor(0);
    var buffer = this.buffers.collisionBoxVertex;
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

                buffer.add(anchorPoint, tl, maxZoom, placementZoom);
                buffer.add(anchorPoint, tr, maxZoom, placementZoom);
                buffer.add(anchorPoint, tr, maxZoom, placementZoom);
                buffer.add(anchorPoint, br, maxZoom, placementZoom);
                buffer.add(anchorPoint, br, maxZoom, placementZoom);
                buffer.add(anchorPoint, bl, maxZoom, placementZoom);
                buffer.add(anchorPoint, bl, maxZoom, placementZoom);
                buffer.add(anchorPoint, tl, maxZoom, placementZoom);

                this.elementGroups.collisionBox.current.vertexLength += 8;
            }
        }
    }
};

function SymbolInstance(anchor, line, shapedText, shapedIcon, layout, properties, addToBuffers,
                        textBoxScale, textPadding, textAlongLine,
                        iconBoxScale, iconPadding, iconAlongLine) {

    this.x = anchor.x;
    this.y = anchor.y;
    this.hasText = !!shapedText;
    this.hasIcon = !!shapedIcon;
    this.layout = layout;
    this.properties = properties;

    if (this.hasText) {
        this.glyphQuads = addToBuffers ? getGlyphQuads(anchor, shapedText, textBoxScale, line, layout, textAlongLine) : [];
        this.textCollisionFeature = new CollisionFeature(line, anchor, shapedText, textBoxScale, textPadding, textAlongLine);
    }

    if (this.hasIcon) {
        this.iconQuads = addToBuffers ? getIconQuads(anchor, shapedIcon, iconBoxScale, line, layout, iconAlongLine) : [];
        this.iconCollisionFeature = new CollisionFeature(line, anchor, shapedIcon, iconBoxScale, iconPadding, iconAlongLine);
    }
}
