/*
 * Create and manage a canvas element with glyphs available to GL as
 * a texture with coordinates.
 */
function LabelTextureManager(map) {
    this.canvases = [];
    this.contexts = [];
    this.glyphs = {};
    this.map = map;
    this.pixelRatio = map.pixelRatio;
    this.newCanvas();
    this.lineHeights = {};
    this.rotation = 0;
    this.updated = false;
}

/*
 * Initialize a canvas and assign it to be our main.
 */
LabelTextureManager.prototype.newCanvas = function() {
    this.cursor = { x: 0, y: 0, ny: 0 };

    var canvas = document.createElement('canvas');
    canvas.width = 1024 * this.pixelRatio;
    canvas.height = 128 * this.pixelRatio;
    this.free = [{ x: 0, y: 0, w: canvas.width, h: canvas.height }];
    this.canvases.push(canvas);
    document.body.appendChild(canvas);

    var context = canvas.getContext('2d');
    context.textBaseline = 'alphabetic';
    context.scale(this.pixelRatio, this.pixelRatio);
    this.contexts.push(context);
};

LabelTextureManager.prototype.bind = function(painter) {
    var gl = painter.gl;
    gl.uniform2fv(painter.labelShader.u_texsize, [ this.canvases[0].width, this.canvases[0].height ]);

    if (!this.updated) {
        return true;
    }
    this.updated = false;

    if (!this.glTexture) this.glTexture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
    // Curious if gl.ALPHA is faster? It's all we need here...
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvases[0]);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
};

LabelTextureManager.prototype.addGlyph = function(font, fontSize, rotation, glyph) {
    this.contexts[0].font = fontSize + 'px ' + font;
    var metrics = this.measure(font, fontSize, rotation, glyph);

    // Decide on a best fit.
    var smallest = { x: Infinity, y: Infinity }, smallestI = -1;
    for (var i = 0; i < this.free.length; i++) {
        if (metrics.bW < this.free[i].w && // it fits width
            metrics.bH < this.free[i].h && // it fits height
            this.free[i].y <= smallest.y && // top left
            this.free[i].x < smallest.x) {
            smallest = this.free[i];
            smallestI = i;
        }
    }
    if (smallestI == -1) {
       this.canvases[0].height = this.canvases[0].height * 2;
       this.contexts[0].textBaseline = 'alphabetic';

       for (var g in this.glyphs) {
           if (this.contexts[0].font != this.glyphs[g].font) {
               this.contexts[0].font = this.glyphs[g].font;
           }

           this.contexts[0].rotate(this.glyphs[g].rotation);
           this.contexts[0].fillText(this.glyphs[g].glyph, this.glyphs[g].p.x, this.glyphs[g].p.y);
           this.contexts[0].rotate(-this.glyphs[g].rotation);
       }
       smallestI = this.free.length;
       this.free.push({ x: 0, y: this.canvases[0].height / 2, w: this.canvases[0].width, h: this.canvases[0].height / 2 });

       this.contexts[0].font = fontSize + 'px ' + font;
    }
    var rect = this.free[smallestI];

    // Pack into top left
    var p = metrics.p = rotate(-rotation, vectorAdd(rect, metrics.p));
    metrics.font = fontSize + 'px ' + font;
    metrics.glyph = glyph;
    metrics.x = rect.x + 2;
    metrics.y = rect.y + 2;
    metrics.rotation = rotation;

    this.contexts[0].rotate(rotation);
    this.contexts[0].fillText(glyph, p.x, p.y);
    this.contexts[0].rotate(-rotation);

    this.free.splice(smallestI, 1);
    // SAS
    var b1, b2;
    if (rect.w < rect.h) {
        // split horizontally
        // +--+---+
        // |__|___|  <-- b1
        // +------+  <-- b2
        b1 = { x: rect.x + metrics.bW, y: rect.y, w: rect.w - metrics.bW, h: metrics.bH };
        b2 = { x: rect.x, y: rect.y + metrics.bH, w: rect.w, h: rect.h - metrics.bH };
    }
    else {
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

    var glyphId = fontSize + font + '-' + rotation + '-' + glyph;
    this.glyphs[glyphId] = metrics;
};

LabelTextureManager.prototype.measure = function(font, fontSize, rotation, glyph) {
    var metrics;
    if (this.map.fonts[font][glyph]) {
        metrics = {
            w: this.map.fonts[font][glyph][0] / 1024 * fontSize, // +2 just to give it some space.
            h: this.map.fonts[font][glyph][1] / 1024 * fontSize,
            a: this.map.fonts[font][glyph][4] / 1024 * fontSize, // Advance
            b: this.map.fonts[font][glyph][3] / 1024 * fontSize // Horizontal Y bearing
        };
    }
    else {
        metrics = this.contexts[0].measureText(glyph);

        if (!(font in this.lineHeights)) {
            var p = document.createElement('p');
            p.style.font = font;
            p.innerText = 'Ag';
            document.body.appendChild(p);
            this.lineHeights[font] = p.offsetHeight;
            document.body.removeChild(p);
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
    metrics.p = vectorAdd(
        { x: metrics.bW / 2, y: metrics.bH / 2 }, // To the middle of the letter (and box)
        rotate(rotation, { x: -metrics.w / 2, y: (-metrics.h / 2) + metrics.b }) // To the baseline
    );

    return metrics;
};

LabelTextureManager.prototype.drawFree = function(color) {
    for (var i = 0; i < this.free.length; i++) {
        this._drawBox(this.free[i], color || 'rgba(0, 0, 200, 0.3)');
    }
};

LabelTextureManager.prototype.drawChars = function(color) {
    for (var i in this.glyphs) {
        this._drawBox(this.glyphs[i], color);
    }
};

LabelTextureManager.prototype._drawBox = function(coords, color) {
    this.contexts[0].beginPath();
    this.contexts[0].lineWidth = 2;
    this.contexts[0].strokeStyle = color || 'rgba(0, 200, 0, 0.3)';
    this.contexts[0].rect(coords.x, coords.y, coords.w, coords.h);
    this.contexts[0].stroke();
};

LabelTextureManager.prototype.getGlyph = function(font, fontSize, rotation, glyph) {
    var glyphId = fontSize + font + '-' + rotation + '-' + glyph;
    if (!this.glyphs[glyphId]) {
        this.addGlyph(font, fontSize, rotation, glyph);
    }
    return this.glyphs[glyphId];
};
