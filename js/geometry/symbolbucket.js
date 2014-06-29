'use strict';

var ElementGroups = require('./elementgroups.js');
var Anchor = require('./anchor.js');
var interpolate = require('./interpolate.js');
var Point = require('point-geometry');
var resolveTokens = require('../util/token.js');
var Placement = require('../text/placement.js');

if (typeof self !== 'undefined') {
    var actor = require('../worker/worker.js');
    var Loader = require('../text/loader.js');
    var Shaping = require('../text/shaping.js');
    var getRanges = require('../text/ranges.js');
}

module.exports = SymbolBucket;

function SymbolBucket(info, buffers, collision, elementGroups) {
    this.info = info;
    this.buffers = buffers;
    this.collision = collision;

    if (info['symbol-placement'] === 'line' && !info.hasOwnProperty('symbol-rotation-alignment')) {
        info['symbol-rotation-alignment'] = 'map';
    }

    if (elementGroups) {
        this.elementGroups = elementGroups;
    } else {
        this.elementGroups = {
            text: new ElementGroups(buffers.glyphVertex),
            icon: new ElementGroups(buffers.iconVertex)
        };
    }
}

SymbolBucket.prototype.addFeatures = function() {
    var info = this.info;
    var features = this.features;
    var text_features = this.data.text_features;

    var alignment = 0.5;
    if (info['text-alignment'] === 'right') alignment = 1;
    else if (info['text-alignment'] === 'left') alignment = 0;

    var oneEm = 24;
    var lineHeight = info['text-line-height'] * oneEm;
    var maxWidth = info['text-max-width'] * oneEm;
    var spacing = info['text-letter-spacing'] * oneEm;
    var fontstack = info['text-font'];

    for (var k = 0; k < features.length; k++) {

        var feature = features[k];
        var text = text_features[k];
        var lines = feature.loadGeometry();

        var shaping = false;
        if (text) {
            shaping = Shaping.shape(text, fontstack, this.stacks, maxWidth, lineHeight, alignment, spacing);
        }

        var image = false;
        if (this.sprite && this.info['icon-image']) {
            image = this.sprite[resolveTokens(feature.properties, info['icon-image'])];

            if (image) {
                // match glyph tex object. TODO change
                image.w = image.width;
                image.h = image.height;
            }
        }

        if (!shaping && !image) continue;
        this.addFeature(lines, this.stacks, shaping, image);
    }
};

function byScale(a, b) {
    return a.scale - b.scale;
}

SymbolBucket.prototype.addFeature = function(lines, faces, shaping, image) {
    var info = this.info;
    var collision = this.collision;

    var minScale = 0.5;
    var glyphSize = 24;

    var horizontal = info['symbol-rotation-alignment'] === 'viewport',
        fontScale = info['text-max-size'] / glyphSize,
        boxScale = collision.tilePixelRatio * fontScale;

    for (var i = 0; i < lines.length; i++) {

        var line = lines[i];
        var anchors;

        if (info['symbol-placement'] === 'line') {
            // Line labels
            anchors = interpolate(line, info['symbol-min-distance'], minScale);

            // Sort anchors by segment so that we can start placement with the
            // anchors that can be shown at the lowest zoom levels.
            anchors.sort(byScale);

        } else {
            // Point labels
            anchors = [new Anchor(line[0].x, line[0].y, 0, minScale)];
        }


        // TODO: figure out correct ascender height.
        var origin = new Point(0, -17);

        for (var j = 0, len = anchors.length; j < len; j++) {
            var anchor = anchors[j];

            var symbols = {
                glyphs: [],
                icons: [],
                boxes: []
            };

            if (shaping) Placement.getGlyphs(symbols, anchor, origin, shaping, faces, boxScale, horizontal, line, info);
            if (image) Placement.getIcon(symbols, anchor, image, collision.tilePixelRatio, line, this.spritePixelRatio, info);

            var place = collision.place(symbols.boxes, anchor, horizontal, info);

            if (place) {
                this.addSymbols(this.buffers.glyphVertex, this.elementGroups.text, symbols.glyphs, place);
                this.addSymbols(this.buffers.iconVertex, this.elementGroups.icon, symbols.icons, place);
            }
        }
    }
};

SymbolBucket.prototype.addSymbols = function(buffer, elementGroups, symbols, place) {

    var zoom = this.collision.zoom;

    elementGroups.makeRoomFor(0);
    var elementGroup = elementGroups.current;

    var placementZoom = place.zoom + zoom;
    var placementRange = place.rotationRange;

    for (var k = 0; k < symbols.length; k++) {

        var symbol = symbols[k],
            tl = symbol.tl,
            tr = symbol.tr,
            bl = symbol.bl,
            br = symbol.br,
            tex = symbol.tex,
            angle = symbol.angle,
            anchor = symbol.anchor,


            minZoom = Math.max(zoom + Math.log(symbol.minScale) / Math.LN2, placementZoom),
            maxZoom = Math.min(zoom + Math.log(symbol.maxScale) / Math.LN2, 25);

        if (maxZoom <= minZoom) continue;

        // Lower min zoom so that while fading out the label it can be shown outside of collision-free zoom levels
        if (minZoom === placementZoom) minZoom = 0;

        // first triangle
        buffer.add(anchor.x, anchor.y, tl.x, tl.y, tex.x, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
        buffer.add(anchor.x, anchor.y, tr.x, tr.y, tex.x + tex.w, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
        buffer.add(anchor.x, anchor.y, bl.x, bl.y, tex.x, tex.y + tex.h, angle, minZoom, placementRange, maxZoom, placementZoom);

        // second triangle
        buffer.add(anchor.x, anchor.y, tr.x, tr.y, tex.x + tex.w, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
        buffer.add(anchor.x, anchor.y, bl.x, bl.y, tex.x, tex.y + tex.h, angle, minZoom, placementRange, maxZoom, placementZoom);
        buffer.add(anchor.x, anchor.y, br.x, br.y, tex.x + tex.w, tex.y + tex.h, angle, minZoom, placementRange, maxZoom, placementZoom);

        elementGroup.vertexLength += 6;
    }

};

SymbolBucket.prototype.getDependencies = function(tile, callback) {
    var firstdone = false;
    var firsterr;
    this.getTextDependencies(tile, done);
    this.getIconDependencies(tile, done);
    function done(err) {
        if (err || firstdone) callback(err);
        firstdone = true;
        firsterr = err;
    }
};

SymbolBucket.prototype.getIconDependencies = function(tile, callback) {
    var bucket = this;
    if (this.info['icon-image']) {
        actor.send('get sprite json', {}, function(err, data) {
            bucket.sprite = data.sprite;
            bucket.spritePixelRatio = data.retina ? 2 : 1;
            callback(err);
        });
    } else {
        callback();
    }
};

SymbolBucket.prototype.getTextDependencies = function(tile, callback) {
    var features = this.features;
    var info = this.info;
    var fontstack = info['text-font'];
    var data = getRanges(features, info);
    var ranges = data.ranges;
    var codepoints = data.codepoints;

    var bucket = this;
    this.data = data;
    
    Loader.whenLoaded(tile, fontstack, ranges, function(err) {
        if (err) return callback(err);

        var stacks = {};
        stacks[fontstack] = {};
        stacks[fontstack].glyphs = codepoints.reduce(function(obj, codepoint) {
            obj[codepoint] = Loader.stacks[fontstack].glyphs[codepoint];
            return obj;
        }, {});

        bucket.stacks = stacks;

        actor.send('add glyphs', {
            id: tile.id,
            stacks: stacks
        }, function(err, rects) {

            if (err) return callback(err);

            // Merge the rectangles of the glyph positions into the face object
            for (var name in rects) {
                if (!stacks[name]) stacks[name] = {};
                stacks[name].rects = rects[name];
            }

            callback();
        });
    });

};

SymbolBucket.prototype.hasData = function() {
    return !!this.elementGroups.text.current;
};
