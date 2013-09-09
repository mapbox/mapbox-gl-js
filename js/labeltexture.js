function measureLineHeight(font) {
    var p = document.createElement('p'),
        height;
    p.style.font = font;
    p.innerText = 'Ag';
    document.body.appendChild(p);
    height = p.offsetHeight;
    document.body.removeChild(p);
    return height;
}

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

    var canvas = document.createElement('canvas');
    canvas.width = 1024 * this.map.pixelRatio;
    canvas.height = 32;
    this.canvases.push(canvas);
    // document.body.appendChild(canvas);

    var context = canvas.getContext('2d');
    context.textBaseline = 'top';
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

LabelTextureManager.prototype.addGlyph = function(font, rotation, glyph) {
    // TODO: do a better job calculating where we should place each glyph on the canvas.
    // They could be quite a bit more tightly packed than they are now.
    this.contexts[0].font = font;
    var metrics = this.contexts[0].measureText(glyph);

    if (!(font in this.lineHeights)) {
        this.lineHeights[font] = measureLineHeight(font);
    }
    metrics.height = this.lineHeights[font];

    var cornerPoints = [
        rotate(this.rotation, [metrics.width/2, metrics.height/2]),
        rotate(this.rotation, [-metrics.width/2, metrics.height/2]),
        rotate(this.rotation, [metrics.width/2, -metrics.height/2]),
        rotate(this.rotation, [-metrics.width/2, -metrics.height/2])
    ];
    var extent = { top: cornerPoints[0][1], bottom: cornerPoints[0][1], left: cornerPoints[0][0], right: cornerPoints[0][0] };
    for (var i = 1; i < cornerPoints.length; i++) {
        extent.top = Math.max(extent.top, cornerPoints[i][1]);
        extent.bottom = Math.min(extent.bottom, cornerPoints[i][1]);
        extent.right = Math.max(extent.right, cornerPoints[i][0]);
        extent.left = Math.min(extent.left, cornerPoints[i][0]);
    }
    metrics.boxHeight = extent.top - extent.bottom;
    metrics.boxWidth = extent.right - extent.left;

    // Advance cursor.
    var cursor = this.cursor;
    if (cursor.x + metrics.width + 20 > this.canvases[0].width) {
        cursor.x = 0;
        cursor.y = cursor.ny;

        if (cursor.y + metrics.boxHeight > this.canvases[0].height) {
            this.canvases[0].height = this.canvases[0].height * 2;
            this.contexts[0].textBaseline = 'top';
            this.contexts[0].font = font;

            // Todo: do this for all fonts/glyphs/rotations:
            for (var _glyph in this.glyphs[font][rotation]) {
                this.contexts[0].fillText(_glyph, this.glyphs[font][rotation][_glyph].r[0], this.glyphs[font][rotation][_glyph].r[1]);
            }
        }
    }

    var toTopLeftOfBox = [ cursor.x, cursor.y ],
        fromTopLeftToMiddle = [ metrics.boxWidth / 2, metrics.boxHeight / 2 ],
        fromMiddleToTopLeft = rotate(this.rotation, [ -metrics.width / 2, -metrics.height / 2 ]);
    var r = vectorAdd(toTopLeftOfBox, vectorAdd(fromTopLeftToMiddle, fromMiddleToTopLeft));

    var coords = {
        x: (cursor.x) / this.pixelRatio, // upper-left
        y: (cursor.y) / this.pixelRatio, // upper-left
        w: (metrics.boxWidth) / this.pixelRatio,
        h: metrics.boxHeight / this.pixelRatio,
        trueW: metrics.width / this.pixelRatio,
        trueH: metrics.height / this.pixelRatio,
        r: r
    };

    r = rotate(-this.rotation, r);
    //console.log(glyph);
    this.contexts[0].fillText(glyph, r[0], r[1]);

    cursor.ny = Math.max(cursor.ny, cursor.y + metrics.boxHeight);
    cursor.x += metrics.boxWidth;

    if (!this.glyphs[font]) this.glyphs[font] = {};
    if (!this.glyphs[font][rotation]) this.glyphs[font][rotation] = {};

    this.glyphs[font][rotation][glyph] = coords;
    this.updated = true;
};

LabelTextureManager.prototype.getGlyph = function(font, rotation, glyph) {
    if (glyph) {
        if (!this.glyphs[font] || !this.glyphs[font][rotation] || !this.glyphs[font][rotation][glyph]) {
            this.addGlyph(font, rotation, glyph);
        }
        return this.glyphs[font][rotation][glyph];
    }
    else if (font && this.glyphs[font] && this.glyphs[font][rotation]) {
        return this.glyphs[font][rotation];
    }
    else if (font && this.glyphs[font]) {
        return this.glyphs[font];
    }
    return {};
};

function LabelTexture(textureManager) {
    this.textureManager = textureManager;

    this.vertices = [];
    this.elements = [];

    this.glyphs = {};
    this.rotation = 0;
}

LabelTexture.prototype.getGlyph = function(font, rotation, glyph) {
    return this.textureManager.getGlyph(font, rotation, glyph);
};

LabelTexture.prototype.drawGlyph = function(c, x, y, xOffset) {
    // drawing location x, drawing location y, texture x, texture y
    this.vertices.push(
        x, y, xOffset,       0,   c.x,       c.y,
        x, y, xOffset + c.w, 0,   c.x + c.w, c.y,
        x, y, xOffset + c.w, c.h, c.x + c.w, c.y + c.h,
        x, y, xOffset,       c.h, c.x,       c.y + c.h
    );
    var l = this.elements.length * 2 / 3;
    this.elements.push(l, l+1, l+2, l, l+2, l+3);

    return c.w;
};

LabelTexture.prototype.drawText = function(font, text, x, y) {
    if (!text) return true;

    var rotation = 0, xOffset = 0, c;
    for (var i = 0; i < text.length; i++) {
        c = this.getGlyph(font, rotation, text[i]);
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
