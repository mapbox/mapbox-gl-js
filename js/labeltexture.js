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

LabelTextureManager.prototype.newCanvas = function() {
    this.cursor = { x: 0, y: 0, ny: 0 };
    this.free = [{ x: 0, y: 0, w: 1024, h: 128 }];

    var canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    this.canvases.push(canvas);
    document.body.appendChild(canvas);

    var context = canvas.getContext('2d');
    context.textBaseline = 'alphabetic';
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
    // BAF algorithm.
    var smallest = Infinity, smallestI = -1;
    for (var i = 0; i < this.free.length; i++) {
        if (metrics.boxWidth < this.free[i].w && // it fits width
            metrics.boxHeight < this.free[i].h && // it fits height
            (this.free[i].w*this.free[i].h) < smallest) { // The area is smaller than the smallest
            smallest = this.free[i].w * this.free[i].h;
            smallestI = i;
        }
    }
    if (smallestI == -1) {
       this.canvases[0].height = this.canvases[0].height * 2;
       this.contexts[0].textBaseline = 'bottom';
       this.contexts[0].font = fontSize + 'px ' + font; // TODO: handle multiple fonts.

       // Todo: do this for all fonts/glyphs/rotations:
       for (var g in this.glyphs) {
           this.contexts[0].fillText(this.glyphs[g].glyph, this.glyphs[g].r.x, this.glyphs[g].r.y);
       }
       smallestI = this.free.length;
       this.free.push({ x: 0, y: this.canvases[0].height / 2, w: this.canvases[0].width, h: this.canvases[0].height / 2 });
    }
    var rect = this.free[smallestI];
    // Pack into top left

    r = rotate(-this.rotation, vectorAdd(rect, metrics.r));

    var coords = {
        x: (rect.x) / this.pixelRatio, // upper-left
        y: (rect.y) / this.pixelRatio, // upper-left
        w: (metrics.boxWidth) / this.pixelRatio,
        h: metrics.boxHeight / this.pixelRatio,
        trueW: metrics.width / this.pixelRatio,
        trueH: metrics.height / this.pixelRatio,
        r: r,
        glyph: glyph
    };

    this.contexts[0].fillText(glyph, r.x, r.y);

    // SAS
    var b1, b2;
    if (rect.w < rect.h) {
        // split horizontally
        // +--+---+
        // |__|___|  <-- b1
        // +------+  <-- b2
        b1 = { x: rect.x + metrics.boxWidth, y: rect.y, w: rect.w - metrics.boxWidth, h: metrics.boxHeight };
        b2 = { x: rect.x, y: rect.y + metrics.boxHeight, w: rect.w, h: rect.h - metrics.boxHeight };
    }
    else {
        // split vertically
        // +--+---+
        // |__|   | <-- b1
        // +--|---+ <-- b2
        b1 = { x: rect.x + metrics.boxWidth, y: rect.y, w: rect.w - metrics.boxWidth, h: rect.h };
        b2 = { x: rect.x, y: rect.y + metrics.boxHeight, w: metrics.boxWidth, h: rect.h - metrics.boxHeight };
    }
    this.free.splice(smallestI, 1);
    // Only save the free spaces if they're big enough that something might actually fit in them.
    if ((b1.w * b1.h) > 90) {
        this.free.push(b1);
    }
    if ((b2.w * b2.h) > 90) {
        this.free.push(b2);
    }
    this.updated = true;
    return coords;
};

/*
LabelTextureManager.prototype.drawFree = function() {
    for (var i = 0; i < this.free.length; i++) {
        var free = this.free[i];
        this.contexts[0].beginPath();
        this.contexts[0].lineWidth = 2;
        this.contexts[0].strokeStyle = 'rgba(0, 0, 200, 0.3)';
        this.contexts[0].rect(free.x, free.y, free.w, free.h);
        this.contexts[0].stroke();
    }
};
*/

LabelTextureManager.prototype.measure = function(font, fontSize, rotation, glyph) {
    var metrics = this.contexts[0].measureText(glyph);

    if (!(font in this.lineHeights)) {
        var p = document.createElement('p');
        p.style.font = font;
        p.innerText = 'Ag';
        document.body.appendChild(p);
        this.lineHeights[font] = p.offsetHeight;
        document.body.removeChild(p);
    }
    metrics.height = this.lineHeights[font];

    var a = rotate(this.rotation, { x: metrics.width/2, y: metrics.height/2 }),
        b = rotate(this.rotation, { x: -metrics.width/2, y: metrics.height/2 });

    metrics.boxWidth = 2 * Math.max(Math.abs(a.x), Math.abs(b.x));
    metrics.boxHeight = 2 * Math.max(Math.abs(a.y), Math.abs(b.y));

    var fromTopLeftToMiddle = { x: metrics.boxWidth / 2, y: metrics.boxHeight / 2 },
        fromMiddleToTopLeft = rotate(this.rotation, { x: -metrics.width / 2, y: -metrics.height / 2 });

    metrics.r = vectorAdd(fromTopLeftToMiddle, fromMiddleToTopLeft);

    return metrics;
};

LabelTextureManager.prototype.getGlyph = function(font, fontSize, rotation, glyph) {
    var glyphId = fontSize + font + '-' + rotation + '-' + glyph;
    if (!this.glyphs[glyphId]) {
        return this.glyphs[glyphId] = this.addGlyph(font, fontSize, rotation, glyph);
    }
    return this.glyphs[glyphId];
};

function LabelTexture(textureManager) {
    this.textureManager = textureManager;

    this.vertices = [];
    this.elements = [];

    this.glyphs = {};
    this.rotation = 0;
}

LabelTexture.prototype.drawGlyph = function(c, x, y, xOffset) {
    // drawing location x, drawing location y, texture x, texture y
    this.vertices.push(
        x, y, xOffset,       0,   c.x,       c.y - c.h,
        x, y, xOffset + c.w, 0,   c.x + c.w, c.y - c.h,
        x, y, xOffset + c.w, c.h, c.x + c.w, c.y,
        x, y, xOffset,       c.h, c.x,       c.y
    );
    var l = this.elements.length * 2 / 3;
    this.elements.push(l, l+1, l+2, l, l+2, l+3);

    return c.w;
};

LabelTexture.prototype.drawText = function(font, fontSize, text, x, y) {
    if (!text) return true;

    var rotation = 0, xOffset = 0, c;
    for (var i = 0; i < text.length; i++) {
        c = this.textureManager.getGlyph(font, fontSize, rotation, text[i]);
        if (c) {
            xOffset += this.drawGlyph(c, x, y, xOffset);
        }
    }
    return true;
};

LabelTexture.prototype.bind = function(painter) {
    this.textureManager.bind(painter);

    if (this.labelBuffer) return true;
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

LabelTexture.prototype.reset = function() {
    this.elements = [];
    this.vertices = [];
};
