'use strict';

var ElementGroups = require('./elementgroups.js');

var getRanges = require('../text/ranges.js');
var Loader = require('../text/loader.js');
var Shaping = require('../text/shaping.js');

module.exports = TextBucket;

function TextBucket(info, buffers, placement, elementGroups) {
    this.info = info;
    this.buffers = buffers;
    this.placement = placement;
    this.elementGroups = elementGroups || new ElementGroups(buffers.glyphVertex);
}

TextBucket.prototype.addFeatures = function() {
    var text_features = this.data.text_features;

    var alignment = 0.5;
    if (this.info['text-alignment'] === 'right') alignment = 1;
    else if (this.info['text-alignment'] === 'left') alignment = 0;

    var oneEm = 24;
    var lineHeight = (this.info['text-line-height'] || 1.2) * oneEm;
    var maxWidth = (this.info['text-max-width'] || 15) * oneEm;
    var spacing = (this.info['text-letter-spacing'] || 0) * oneEm;
    var fontstack = this.info['text-font'];

    for (var k = 0; k < text_features.length; k++) {
        var text = text_features[k].text;
        var lines = text_features[k].geometry;
        var shaping = Shaping.shape(text, fontstack, this.stacks, maxWidth, lineHeight, alignment, spacing);
        if (!shaping) continue;
        this.addFeature(lines, this.stacks, shaping);
    }
};

TextBucket.prototype.addFeature = function(lines, faces, shaping) {
    for (var i = 0; i < lines.length; i++) {
        this.placement.addFeature(lines[i], this.info, faces, shaping, this);
    }
};

TextBucket.prototype.addGlyphs = function(glyphs, placementZoom, placementRange, zoom) {

    var glyphVertex = this.buffers.glyphVertex;
    placementZoom += zoom;

    this.elementGroups.makeRoomFor(0);
    var elementGroup = this.elementGroups.current;

    for (var k = 0; k < glyphs.length; k++) {

        var glyph = glyphs[k],
            tl = glyph.tl,
            tr = glyph.tr,
            bl = glyph.bl,
            br = glyph.br,
            tex = glyph.tex,
            angle = glyph.angle,
            anchor = glyph.anchor,

            minZoom = Math.max(zoom + Math.log(glyph.minScale) / Math.LN2, placementZoom),
            maxZoom = Math.min(zoom + Math.log(glyph.maxScale) / Math.LN2, 25);

        if (maxZoom <= minZoom) continue;

        // Lower min zoom so that while fading out the label it can be shown outside of collision-free zoom levels
        if (minZoom === placementZoom) minZoom = 0;

        // first triangle
        glyphVertex.add(anchor.x, anchor.y, tl.x, tl.y, tex.x, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
        glyphVertex.add(anchor.x, anchor.y, tr.x, tr.y, tex.x + tex.w, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
        glyphVertex.add(anchor.x, anchor.y, bl.x, bl.y, tex.x, tex.y + tex.h, angle, minZoom, placementRange, maxZoom, placementZoom);

        // second triangle
        glyphVertex.add(anchor.x, anchor.y, tr.x, tr.y, tex.x + tex.w, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
        glyphVertex.add(anchor.x, anchor.y, bl.x, bl.y, tex.x, tex.y + tex.h, angle, minZoom, placementRange, maxZoom, placementZoom);
        glyphVertex.add(anchor.x, anchor.y, br.x, br.y, tex.x + tex.w, tex.y + tex.h, angle, minZoom, placementRange, maxZoom, placementZoom);

        elementGroup.vertexLength += 6;
    }

};

TextBucket.prototype.getDependencies = function(tile, actor, callback) {
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
