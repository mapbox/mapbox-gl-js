'use strict';

var ElementGroups = require('./element_groups');
var Anchor = require('../symbol/anchor');
var getAnchors = require('../symbol/interpolate');
var resolveTokens = require('../util/token');
var Placement = require('../symbol/placement');
var Shaping = require('../symbol/shaping');
var resolveText = require('../symbol/resolve_text');
var resolveIcons = require('../symbol/resolve_icons');
var mergeLines = require('../symbol/mergelines');
var shapeText = Shaping.shapeText;
var shapeIcon = Shaping.shapeIcon;

var PlacementFeature = require('../placement/placement_feature');

module.exports = SymbolBucket;

function SymbolBucket(buffers, layoutProperties, placement, overscaling) {
    this.buffers = buffers;
    this.layoutProperties = layoutProperties;
    this.placement = placement;
    this.overscaling = overscaling;

    this.symbolFeatures = [];

}

SymbolBucket.prototype.addFeatures = function() {
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
    var fontstack = layout['text-font'];

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

    for (var k = 0; k < features.length; k++) {
        if (!geometries[k]) continue;

        var shapedText, shapedIcon;

        if (textFeatures[k]) {
            shapedText = shapeText(textFeatures[k], this.stacks[fontstack], maxWidth,
                    lineHeight, horizontalAlign, verticalAlign, justify, spacing, textOffset);
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
        }

        if (shapedText || shapedIcon) {
            this.addFeature(geometries[k], shapedText, shapedIcon);
        }
    }

    this.placeFeatures(this.buffers);
};

SymbolBucket.prototype.addFeature = function(lines, shapedText, shapedIcon) {
    var layout = this.layoutProperties;
    var placement = this.placement;

    var minScale = 0.5;
    var glyphSize = 24;

    var fontScale = layout['text-max-size'] / glyphSize,
        textBoxScale = placement.tilePixelRatio * fontScale,
        iconBoxScale = placement.tilePixelRatio * layout['icon-max-size'],
        symbolMinDistance = placement.tilePixelRatio * layout['symbol-min-distance'],
        avoidEdges = layout['symbol-avoid-edges'],
        textPadding = layout['text-padding'] * placement.tilePixelRatio,
        iconPadding = layout['icon-padding'] * placement.tilePixelRatio,
        textMaxAngle = layout['text-max-angle'] / 180 * Math.PI;

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];

        // Calculate the anchor points around which you want to place labels
        var anchors = layout['symbol-placement'] === 'line' ?
            getAnchors(line, symbolMinDistance, textMaxAngle, shapedText, glyphSize, textBoxScale, this.overscaling) :
            [ new Anchor(line[0].x, line[0].y, 0, minScale) ];

        // For each potential label, create the placement features used to check for collisions, and the quads use for rendering.
        for (var j = 0, len = anchors.length; j < len; j++) {
            var anchor = anchors[j];

            var inside = !(anchor.x < 0 || anchor.x > 4096 || anchor.y < 0 || anchor.y > 4096);

            if (avoidEdges && !inside) continue;

            var iconPlacementFeature,
                textPlacementFeature,
                glyphQuads,
                iconQuads;

            if (shapedText) {
                glyphQuads = Placement.getGlyphQuads(anchor, shapedText, textBoxScale, line, layout);
                textPlacementFeature = new PlacementFeature(line, anchor, shapedText, textBoxScale, textPadding, layout['text-rotation-alignment'] !== 'viewport');
            }

            if (shapedIcon) {
                iconQuads = Placement.getIconQuads(anchor, shapedIcon, iconBoxScale, line, layout);
                iconPlacementFeature = new PlacementFeature(line, anchor, shapedIcon, iconBoxScale, iconPadding, layout['symbol-placement'] === 'line');
            }

            this.symbolFeatures.push(new SymbolFeature(textPlacementFeature, iconPlacementFeature, glyphQuads, iconQuads, inside));
        }
    }
};

SymbolBucket.prototype.placeFeatures = function(buffers) {

    // Calculate which labels can be shown and when they can be shown and
    // create the bufers used for rendering.

    this.buffers = buffers;

    var elementGroups = this.elementGroups = {
        text: new ElementGroups(buffers.glyphVertex),
        icon: new ElementGroups(buffers.iconVertex),
        sdfIcons: this.sdfIcons
    };

    var layout = this.layoutProperties;
    var placement = this.placement;
    var maxScale = this.placement.maxScale;

    for (var p = 0; p < this.symbolFeatures.length; p++) {
        var symbolFeature = this.symbolFeatures[p];
        var text = symbolFeature.text;
        var icon = symbolFeature.icon;
        var inside = symbolFeature.inside;

        var iconWithoutText = layout['text-optional'] || !text,
            textWithoutIcon = layout['icon-optional'] || !icon;


        // Calculate the scales at which the text and icon can be placed without collision.

        var glyphScale = text && !layout['text-allow-overlap'] ?
            placement.placeFeature(text) : 0.25;

        var iconScale = icon && !layout['icon-allow-overlap'] ?
            placement.placeFeature(icon) : 0.25;


        // Combine the scales for icons and text.

        if (!iconWithoutText && !textWithoutIcon) {
            iconScale = glyphScale = Math.max(iconScale, glyphScale);
        } else if (!textWithoutIcon && glyphScale) {
            glyphScale = Math.max(iconScale, glyphScale);
        } else if (!iconWithoutText && iconScale) {
            iconScale = Math.max(iconScale, glyphScale);
        }


        // Insert final placement into collision tree and add glyphs/icons to buffers

        if (text) {
            if (!layout['text-ignore-placement']) {
                placement.insertFeature(text, glyphScale);
            }
            if (inside && glyphScale <= maxScale) {
                this.addSymbols(buffers.glyphVertex, elementGroups.text, symbolFeature.glyphQuads, glyphScale, layout['text-keep-upright']);
            }
        }

        if (icon) {
            if (!layout['icon-ignore-placement']) {
                placement.insertFeature(icon, iconScale);
            }
            if (inside && iconScale <= maxScale) {
                this.addSymbols(buffers.iconVertex, elementGroups.icon, symbolFeature.iconQuads, iconScale, layout['icon-keep-upright']);
            }
        }

    }

    this.addToDebugBuffers();
};

SymbolBucket.prototype.addSymbols = function(buffer, elementGroups, quads, scale, keepUpright) {

    elementGroups.makeRoomFor(0);
    var elementGroup = elementGroups.current;

    var zoom = this.placement.zoom;
    var placementZoom = Math.log(scale) / Math.LN2 + zoom;
    var placementAngle = this.placement.angle + Math.PI;

    for (var k = 0; k < quads.length; k++) {

        var symbol = quads[k],
            angle = symbol.angle;

        // drop upside down versions of glyphs
        var a = (angle + placementAngle) % (Math.PI * 2);
        if (keepUpright && (a <= Math.PI / 2 || a > Math.PI * 3 / 2)) continue;

        var tl = symbol.tl,
            tr = symbol.tr,
            bl = symbol.bl,
            br = symbol.br,
            tex = symbol.tex,
            anchor = symbol.anchor,

            minZoom = Math.max(zoom + Math.log(symbol.minScale) / Math.LN2, placementZoom),
            maxZoom = Math.min(zoom + Math.log(symbol.maxScale) / Math.LN2, 25);

        if (maxZoom <= minZoom) continue;

        // Lower min zoom so that while fading out the label it can be shown outside of collision-free zoom levels
        if (minZoom === placementZoom) minZoom = 0;

        // first triangle
        buffer.add(anchor.x, anchor.y, tl.x, tl.y, tex.x, tex.y, minZoom, maxZoom, placementZoom);
        buffer.add(anchor.x, anchor.y, tr.x, tr.y, tex.x + tex.w, tex.y, minZoom, maxZoom, placementZoom);
        buffer.add(anchor.x, anchor.y, bl.x, bl.y, tex.x, tex.y + tex.h, minZoom, maxZoom, placementZoom);

        // second triangle
        buffer.add(anchor.x, anchor.y, tr.x, tr.y, tex.x + tex.w, tex.y, minZoom, maxZoom, placementZoom);
        buffer.add(anchor.x, anchor.y, bl.x, bl.y, tex.x, tex.y + tex.h, minZoom, maxZoom, placementZoom);
        buffer.add(anchor.x, anchor.y, br.x, br.y, tex.x + tex.w, tex.y + tex.h, minZoom, maxZoom, placementZoom);

        elementGroup.vertexLength += 6;
    }

};

SymbolBucket.prototype.getDependencies = function(tile, actor, callback) {
    var firstdone = false;
    this.getTextDependencies(tile, actor, done);
    this.getIconDependencies(tile, actor, done);
    function done(err) {
        if (err || firstdone) return callback(err);
        firstdone = true;
    }
};

SymbolBucket.prototype.getIconDependencies = function(tile, actor, callback) {
    if (this.layoutProperties['icon-image']) {
        var features = this.features;
        var icons = resolveIcons(features, this.layoutProperties);

        if (icons.length) {
            actor.send('get icons', {
                id: tile.id,
                icons: icons
            }, setIcons.bind(this));
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
    var fontstack = this.layoutProperties['text-font'];

    var stacks = this.stacks = tile.stacks;
    if (stacks[fontstack] === undefined) {
        stacks[fontstack] = {};
    }
    var stack = stacks[fontstack];

    var data = resolveText(features, this.layoutProperties, stack);
    this.textFeatures = data.textFeatures;

    actor.send('get glyphs', {
        id: tile.id,
        fontstack: fontstack,
        codepoints: data.codepoints
    }, function(err, newstack) {
        if (err) return callback(err);

        for (var codepoint in newstack) {
            stack[codepoint] = newstack[codepoint];
        }

        callback();
    });
};

SymbolBucket.prototype.addToDebugBuffers = function() {

    this.elementGroups.placementBox = new ElementGroups(this.buffers.placementBoxVertex);
    this.elementGroups.placementBox.makeRoomFor(0);

    var cos = Math.cos(-this.placement.angle);
    var sin = Math.sin(-this.placement.angle);

    for (var j = 0; j < this.symbolFeatures.length; j++) {
        for (var i = 0; i < 2; i++) {
            var feature = this.symbolFeatures[j][i === 0 ? 'text' : 'icon'];
            if (!feature) continue;

            var boxes = feature.boxes;

            for (var b = 0; b < boxes.length; b++) {
                var box = boxes[b];

                var tl = { x: box.x1 * cos - box.y1 * sin, y: box.x1 * sin + box.y1 * cos };
                var tr = { x: box.x2 * cos - box.y1 * sin, y: box.x2 * sin + box.y1 * cos };
                var br = { x: box.x2 * cos - box.y2 * sin, y: box.x2 * sin + box.y2 * cos };
                var bl = { x: box.x1 * cos - box.y2 * sin, y: box.x1 * sin + box.y2 * cos };

                var maxZoom = this.placement.zoom + Math.log(box.maxScale) / Math.LN2;
                var placementZoom = this.placement.zoom + Math.log(box.placementScale) / Math.LN2;
                maxZoom = Math.max(0, Math.min(24, maxZoom));
                placementZoom = Math.max(0, Math.min(24, placementZoom));

                this.buffers.placementBoxVertex.add(box, tl, maxZoom, placementZoom);
                this.buffers.placementBoxVertex.add(box, tr, maxZoom, placementZoom);
                this.buffers.placementBoxVertex.add(box, tr, maxZoom, placementZoom);
                this.buffers.placementBoxVertex.add(box, br, maxZoom, placementZoom);
                this.buffers.placementBoxVertex.add(box, br, maxZoom, placementZoom);
                this.buffers.placementBoxVertex.add(box, bl, maxZoom, placementZoom);
                this.buffers.placementBoxVertex.add(box, bl, maxZoom, placementZoom);
                this.buffers.placementBoxVertex.add(box, tl, maxZoom, placementZoom);

                this.elementGroups.placementBox.current.vertexLength += 8;
            }
        }
    }
};

function SymbolFeature(textPlacementFeature, iconPlacementFeature, glyphQuads, iconQuads, inside) {
    this.text = textPlacementFeature;
    this.icon = iconPlacementFeature;
    this.glyphQuads = glyphQuads;
    this.iconQuads = iconQuads;
    this.inside = inside;
}
