// Rotate a vector (multiply the rotation transformation matrix by the vector).
function rotate(a, v) { return [ Math.cos(a) * v[0] - Math.sin(a) * v[1], Math.sin(a) * v[0] + Math.cos(a) * v[1] ]; }
// Subtract vector b from vector a.
function vectorSub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
// Add vectors a and b.
function vectorAdd(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
// Take the magnitude of vector a.
function vectorMag(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1]); }


function LabelTexture(canvas) {
    this.canvas = canvas;
    this.canvas.width = 4096 * pixelRatio;
    this.canvas.height = 4096 * pixelRatio;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.textBaseline = 'top';

    this.cursor = { x: 0, y: 0, ny: 0 };

    this.vertices = [];
    this.elements = [];

    this.lineHeights = {};

    // Debug
    // this.ctx.fillStyle = 'red';
    // this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // document.body.appendChild(this.canvas);
    this.glyphs = {};
    this.rotation = 0;
}

LabelTexture.prototype.renderGlyphs = function(glyphs, font, rotation) {
    this.glyphs[font] = {};

    var rotations = rotation ? 20 : 1;
    for (var i = 0; i < rotations; i++) {
        var rotation = i ? (Math.PI * 2) / i : 0;
        this.glyphs[font][rotation] = {};
        for (var j = 0; j < glyphs.length; j++) {
            this.glyphs[font][rotation][glyphs[j]] = this.addText(glyphs[j], font);
        }
        if (i != rotations - 1) {
            this.rotate((Math.PI * 2) / rotations);
        }
    }
    this.ctx.rotate(-this.rotation);
}

LabelTexture.prototype.rotate = function(rad) {
    this.ctx.rotate(rad);
    this.rotation += rad;
}

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

LabelTexture.prototype.addText = function(text, font, rotation) {
    // TODO: do a better job calculating where we should place each glyph on the canvas.
    // They could be quite a bit more tightly packed than they are now.
    this.ctx.font = font;
    var metrics = this.ctx.measureText(text);

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
    if (cursor.x + metrics.width + 20 > this.canvas.width) {
        cursor.x = 0;
        cursor.y = cursor.ny;
        if (cursor.y + metrics.boxHeight > this.canvas.height) {
            console.warn('texture overflow');
            return;
        }
    }



    var toTopLeftOfBox = [ cursor.x, cursor.y ],
        fromTopLeftToMiddle = [ metrics.boxWidth / 2, metrics.boxHeight / 2 ],
        fromMiddleToTopLeft = rotate(this.rotation, [ -metrics.width / 2, -metrics.height / 2 ]);
    var r = vectorAdd(toTopLeftOfBox, vectorAdd(fromTopLeftToMiddle, fromMiddleToTopLeft));

    var coords = {
        x: (cursor.x) / pixelRatio, // upper-left
        y: (cursor.y) / pixelRatio, // upper-left
        w: (metrics.boxWidth) / pixelRatio,
        h: metrics.boxHeight / pixelRatio,
        trueW: metrics.width / pixelRatio,
        trueH: metrics.height / pixelRatio,
    };


    var r = rotate(-this.rotation, r);

    this.ctx.fillText(text, r[0], r[1]);

    this.ctx.beginPath();
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = 'red';
    //console.log(texture.glyphs[font][rotation][glyph]);
    this.ctx.rect(r[0], r[1], coords.trueW, coords.trueH);
    //this.ctx.stroke();


    cursor.ny = Math.max(cursor.ny, cursor.y + metrics.boxHeight);
    cursor.x += metrics.boxWidth;

    return coords;
};

LabelTexture.prototype.getGlyph = function(font, rotation, glyph) {
    return this.glyphs[font][rotation][glyph];
}

LabelTexture.prototype.drawGlyph = function(c, x, y, mult) {
    // drawing location x, drawing location y, texture x, texture y
    mult = 1 / mult;
    this.vertices.push(
        x,              y,              c.x,       c.y,
        x + mult*(c.w), y,              c.x + c.w, c.y,
        x + mult*(c.w), y + mult*(c.h), c.x + c.w, c.y + c.h,
        x,              y + mult*(c.h), c.x,       c.y + c.h
    );
    var l = this.elements.length * 2 / 3;
    this.elements.push(l, l+1, l+2, l, l+2, l+3);

    return mult*(c.w);
};

LabelTexture.prototype.drawText = function(font, text, x, y, mult) {
    if (!text) return;
    var rotation = 0;
    for (var i = 0; i < text.length; i++) {
        var c = this.getGlyph(font, rotation, text[i]);
        if (c) {
            x += this.drawGlyph(c, x, y, mult);
        }
        else {
            console.warn('Unknown glyph ' + text[i]);
        }
    }
};

LabelTexture.prototype.texturify = function(gl) {
    this.glTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
};

LabelTexture.prototype.reset = function() {
    this.elements = [];
    this.vertices = [];
}
