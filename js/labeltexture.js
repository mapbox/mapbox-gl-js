/*
 * Contains vertices and element indexes required to reference
 * glyphs and labels in a canvas
 */
function LabelTexture(labelCanvas) {
    this.labelCanvas = labelCanvas;

    this.vertices = [];
    this.elements = [];
    this.labelBuffer = null; // a GL buffer

    this.glyphs = {};
    this.rotation = 0;
}

LabelTexture.prototype.reset = function() {
    this.elements = [];
    this.vertices = [];
    this.labelBuffer = null;
};

LabelTexture.prototype._pushGlyphCoords = function(c, x, y, xO, yO) {
    // initial x, intial y, offset x, offset y, texture x, texture y
    this.vertices.push(
        x, y, xO,       yO + c.h - c.b,   c.x,       c.y + c.h,
        x, y, xO + c.w, yO + c.h - c.b,   c.x + c.w, c.y + c.h,
        x, y, xO + c.w, yO + - c.b,       c.x + c.w, c.y,
        x, y, xO,       yO + - c.b,       c.x,       c.y
    );
    var l = this.elements.length * 2 / 3;
    this.elements.push(l, l+1, l+2, l, l+2, l+3);
};

LabelTexture.prototype.drawStraightText = function(font, fontSize, text, x, y) {
    if (!text) return;

    var xO = 0, glyph, ch;
    for (var i = 0; i < text.length; i++) {
        // the character
        ch = text[i];
        // glyph coordinates
        glyph = this.labelCanvas.getOrAddGlyph(font, fontSize, 0, ch);
        this._pushGlyphCoords(glyph, 2 * x, 2 * y, xO, 0);
        xO += glyph.a;
    }
};

LabelTexture.prototype.drawCurvedText = function(font, fontSize, text, vertices) {
    if (!text) return;

    var labelsToDraw = 1,
        segments = [],
        distance = 0;
    for (var i = 1; i < vertices.length; i++) {
        var change = vectorSub(vertices[i], vertices[i - 1]), d = vectorMag(change);
        segments.push({ distance: d, angle: Math.atan2(change.y, change.x) }); // Maybe a better way?
        distance += d;
    }
    if (distance < 1) return;
    var labelStarts = distance / (labelsToDraw + 1),
        currentStart = 0,
        currentSegment = 0,
        currentDistance = 0;
    // TODO: Flip text if the general rotation would render it upside down.
    for (i = 0; i < labelsToDraw; i++) {
        currentStart += labelStarts;
        // Find the segment to start drawing on.
        while (currentDistance < currentStart) {
            currentDistance += segments[currentSegment++].distance;
        }
        // We went one segment too far.
        currentSegment--;
        currentDistance -= segments[currentSegment].distance;

        // Find where to start drawing
        var drawingDistance = currentStart - currentDistance;
        var start = vectorAdd(vertices[currentSegment], {
            x: drawingDistance * Math.cos(segments[currentSegment].angle),
            y: drawingDistance * Math.sin(segments[currentSegment].angle)
        });
        var rotation = segments[currentSegment].angle;
        var xO = 0, yO = 0;

        for (var j = 0; j < text.length; j++) {
            c = this.labelCanvas.getOrAddGlyph(font,
                fontSize,
                parseFloat(rotation.toFixed(1)),
                text[j]);

            this._pushGlyphCoords(c, 2 * start.x, 2 * start.y, xO, yO);
            var rotated = rotate(rotation, { x: c.a, y: 0 });
            xO += rotated.x;
            yO += rotated.y;
            drawingDistance += c.a;

            if (drawingDistance > segments[currentSegment].distance &&
                currentSegment < segments.length - 1) {
                currentSegment++;
                drawingDistance = 0;
                rotation = segments[currentSegment].angle;
            }
        }
    }
};

LabelTexture.prototype.bind = function(painter) {
    this.labelCanvas.bind(painter);

    if (this.labelBuffer) return;
    var gl = painter.gl;

    var labelArray = new Int16Array(this.vertices);
    this.labelBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.labelBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, labelArray, gl.STATIC_DRAW);

    var labelElementArray = new Int16Array(this.elements);
    this.labelElementBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.labelElementBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, labelElementArray, gl.STATIC_DRAW);
};
