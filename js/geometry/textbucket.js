'use strict';

var ElementGroups = require('./elementgroups.js');

module.exports = TextBucket;

function TextBucket(info, buffers, placement, elementGroups) {
    this.info = info;
    this.buffers = buffers;
    this.placement = placement;
    this.elementGroups = elementGroups || new ElementGroups(buffers.glyphVertex);
}

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

TextBucket.prototype.toJSON = function() {
    return {
        indices: this.elementGroups
    };
};

TextBucket.prototype.start = function() {
};
TextBucket.prototype.end = function() {
};
