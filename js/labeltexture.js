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
    canvas.width = 1024 * this.map.pixelRatio;
    canvas.height = 128;
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
    var metrics = this.measure(font, rotation, glyph);

    // Decide on a best fit.
    // BAF algorithm.
    var smallest = Infinity, smallestI = -1;
    for (var i = 0; i < this.free.length; i++) {
        if (metrics.boxWidth < this.free[i].w && // it fits width
            metrics.boxHeight < this.free[i].h && // it fits height
            (this.free[i].w*this.free[i].h) < smallest) { // The area is smaller than the smallest
            smallest = this.free[i].w*this.free[i].h;
            smallestI = i;
        }
    }
    var rect = this.free[smallestI];
    // Pack into top left
    var coords = {
        x: (rect.x) / this.pixelRatio, // upper-left
        y: (rect.y) / this.pixelRatio, // upper-left
        w: (metrics.boxWidth) / this.pixelRatio,
        h: metrics.boxHeight / this.pixelRatio,
        trueW: metrics.width / this.pixelRatio,
        trueH: metrics.height / this.pixelRatio
    };

    var toTopLeftOfBox = [ rect.x, rect.y ];
    var r = vectorAdd(toTopLeftOfBox, metrics.r);
    r = rotate(-this.rotation, r);
    this.contexts[0].fillText(glyph, r[0], r[1]);
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

    if (!this.glyphs[font]) this.glyphs[font] = {};
    if (!this.glyphs[font][rotation]) this.glyphs[font][rotation] = {};

    this.glyphs[font][rotation][glyph] = coords;
    this.updated = true;
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

LabelTextureManager.prototype.measure = function(font, rotation, glyph) {
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

    var fromTopLeftToMiddle = [ metrics.boxWidth / 2, metrics.boxHeight / 2 ],
        fromMiddleToTopLeft = rotate(this.rotation, [ -metrics.width / 2, -metrics.height / 2 ]);

    metrics.r = vectorAdd(fromTopLeftToMiddle, fromMiddleToTopLeft);

    return metrics;
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
