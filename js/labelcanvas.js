/*
 * Create and manage a canvas element with glyphs available to GL as
 * a texture with coordinates.
 */
function LabelCanvas(map) {
    // a map of font/size/glyph/rotation ids to glyph positions
    this.glyphs = {};
    this.map = map;
    this.lineHeights = {};
    this.rotation = 0;
    this.updated = false;

    this.pixelRatio = map.pixelRatio;
    this.width = 1024 * this.pixelRatio;
    this.height = 128 * this.pixelRatio;

    this.cursor = { x: 0, y: 0, ny: 0 };

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.free = [{
        x: 0,
        y: 0,
        w: this.width,
        h: this.height
    }];

    document.body.appendChild(this.canvas);
    this.context = this.canvas.getContext('2d');
    this.context.textBaseline = 'alphabetic';
}

LabelCanvas.prototype.bind = function(painter) {
    var gl = painter.gl;

    gl.uniform2fv(painter.labelShader.u_texsize, [
        this.width,
        this.height
    ]);

    if (!this.updated) {
        return true;
    }
    this.updated = false;

    if (!this.glTexture) this.glTexture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
    // Curious if gl.ALPHA is faster? It's all we need here...
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
};

LabelCanvas.prototype.addGlyph = function(font, fontSize, rotation, glyph) {
    this.context.font = fontSize + 'px ' + font;
    var metrics = this.measureGlyph(font, fontSize, rotation, glyph);

    // Decide on a best fit.
    var smallest = { x: Infinity, y: Infinity },
        smallestI = -1;

    for (var i = 0; i < this.free.length; i++) {
        if (metrics.bW < this.free[i].w && // it fits width
            metrics.bH < this.free[i].h && // it fits height
            this.free[i].y <= smallest.y && // top left
            this.free[i].x < smallest.x) {
            smallest = this.free[i];
            smallestI = i;
        }
    }

    // if there isn't any space for another glyph, enlarge and redraw
    // the canvas
    if (smallestI == -1) {
        this._relayout();
        smallestI = this.free.length;
    }

    var rect = this.free[smallestI];

    // Pack into top left
    var position = metrics.p = rotate(-rotation, vectorAdd(rect, metrics.p));
    metrics.font = fontSize + 'px ' + font;
    metrics.glyph = glyph;
    metrics.x = rect.x + 2;
    metrics.y = rect.y + 2;
    metrics.rotation = rotation;

    // Finally draw the glyph
    this.context.rotate(rotation);
    this.context.fillText(glyph, position.x, position.y);
    this.context.rotate(-rotation);

    this.free.splice(smallestI, 1);

    // Shorter/Longer Axis Split Rule (SAS)
    // http://clb.demon.fi/files/RectangleBinPack.pdf p. 15
    // Ignore the dimension of R and just split long the shorter dimension
    // 
    // See Also:
    // http://www.cs.princeton.edu/~chazelle/pubs/blbinpacking.pdf
    var b1, b2;
    if (rect.w < rect.h) {
        // split horizontally
        // +--+---+
        // |__|___|  <-- b1
        // +------+  <-- b2
        b1 = { x: rect.x + metrics.bW, y: rect.y, w: rect.w - metrics.bW, h: metrics.bH };
        b2 = { x: rect.x, y: rect.y + metrics.bH, w: rect.w, h: rect.h - metrics.bH };
    } else {
        // split vertically
        // +--+---+
        // |__|   | <-- b1
        // +--|---+ <-- b2
        b1 = { x: rect.x + metrics.bW, y: rect.y, w: rect.w - metrics.bW, h: rect.h };
        b2 = { x: rect.x, y: rect.y + metrics.bH, w: metrics.bW, h: rect.h - metrics.bH };
    }

    this.free.push(b1);
    this.free.push(b2);
    this.updated = true;

    metrics.w = Math.ceil(metrics.w + 2);
    metrics.h = Math.ceil(metrics.h + 2);

    var glyphId = this._glyphId(fontSize, font, rotation, glyph);
    this.glyphs[glyphId] = metrics;
};

LabelCanvas.prototype._relayout = function() {
    // enlarge the canvas. this clears all of its contents
    this.canvas.height = this.canvas.height * 2;
    this.context.textBaseline = 'alphabetic';

    // redraw all of the glyphs in the larger canvas
    for (var g in this.glyphs) {
        var glyphData = this.glyphs[g];
        if (this.context.font != glyphData.font) {
            this.context.font = glyphData.font;
        }

        this.context.rotate(glyphData.rotation);
        this.context.fillText(glyphData.glyph, glyphData.p.x, glyphData.p.y);
        this.context.rotate(-glyphData.rotation);
    }

    this.free.push({
        x: 0,
        y: this.canvas.height / 2,
        w: this.canvas.width,
        h: this.canvas.height / 2
    });

    this.context.font = fontSize + 'px ' + font;
};

LabelCanvas.prototype.measureGlyph = function(font, fontSize, rotation, glyph) {
    var metrics;
    if (this.map.fonts[font][glyph]) {
        metrics = {
            w: this.map.fonts[font][glyph][0] / this.width * fontSize, // +2 just to give it some space.
            h: this.map.fonts[font][glyph][1] / this.width * fontSize,
            a: this.map.fonts[font][glyph][4] / this.width * fontSize, // Advance
            b: this.map.fonts[font][glyph][3] / this.width * fontSize // Horizontal Y bearing
        };
    } else {
        metrics = this.context.measureText(glyph);

        if (!(font in this.lineHeights)) {
            this.lineHeights[font] = measureLineHeight(font);
        }
        metrics = {
            w: metrics.width,
            h: this.lineHeights[font],
            a: metrics.width,
            b: this.lineHeights[font]
        };
    }

    var a = rotate(rotation, { x: metrics.w / 2, y: metrics.h / 2 }),
        b = rotate(rotation, { x: -metrics.w / 2, y: metrics.h / 2 });

    metrics.bW = 2 * Math.max(Math.abs(a.x), Math.abs(b.x)) + 4;
    metrics.bH = 2 * Math.max(Math.abs(a.y), Math.abs(b.y)) + 4;

    // Position within box to start writing text
    metrics.p = vectorAdd({
        x: metrics.bW / 2,
        y: metrics.bH / 2
    }, // To the middle of the letter (and box)
        rotate(rotation, {
            x: -metrics.w / 2,
            y: (-metrics.h / 2) + metrics.b
        }) // To the baseline
    );

    return metrics;
};

function measureLineHeight(font) {
    var p = document.createElement('p');
    p.style.font = font;
    p.innerText = 'Ag';
    document.body.appendChild(p);
    var height = p.offsetHeight;
    document.body.removeChild(p);
    return height;
}

LabelCanvas.prototype.getOrAddGlyph = function(font, fontSize, rotation, glyph) {
    var glyphId = this._glyphId(fontSize, font, rotation, glyph);
    if (!this.glyphs[glyphId]) {
        this.addGlyph(font, fontSize, rotation, glyph);
    }
    return this.glyphs[glyphId];
};

LabelCanvas.prototype._glyphId = function(fontSize, font, rotation, glyph) {
    return fontSize + font + '-' + rotation + '-' + glyph;
};
