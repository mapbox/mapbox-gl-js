function LabelTexture(canvas, pixelRatio) {
    this.pixelRatio = pixelRatio;
    this.canvas = canvas;
    this.canvas.height = this.canvas.width = 1024 * this.pixelRatio;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.textBaseline = 'top';

    this.cursor = { x: 0, y: 0, ny: 0 };

    this.vertices = [];
    this.elements = [];

    this.lineHeights = {};

    // Debug
    // this.ctx.fillStyle = 'red';
    // this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    document.body.appendChild(this.canvas);
    this.glyphs = {};
    this.rotation = 0;
}

LabelTexture.prototype.renderGlyphs = function(glyphs, font, rotation) {
    if (!this.glyphs[font]) {
        this.glyphs[font] = {};
    }

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
        x: (cursor.x) / this.pixelRatio, // upper-left
        y: (cursor.y) / this.pixelRatio, // upper-left
        w: (metrics.boxWidth) / this.pixelRatio,
        h: metrics.boxHeight / this.pixelRatio,
        trueW: metrics.width / this.pixelRatio,
        trueH: metrics.height / this.pixelRatio,
    };


    var r = rotate(-this.rotation, r);

    this.ctx.fillText(text, r[0], r[1]);

    /*
    this.ctx.beginPath();
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = 'red';
    console.log(texture.glyphs[font][rotation][glyph]);
    this.ctx.rect(r[0], r[1], coords.trueW, coords.trueH);
    this.ctx.stroke();
    */

    cursor.ny = Math.max(cursor.ny, cursor.y + metrics.boxHeight);
    cursor.x += metrics.boxWidth;

    return coords;
};

LabelTexture.prototype.getGlyph = function(font, rotation, glyph) {
    if (glyph && this.glyphs[font] && this.glyphs[font][rotation] && this.glyphs[font][rotation][glyph]) {
        return this.glyphs[font][rotation][glyph];
    }
    else if (font && this.glyphs[font] && this.glyphs[font][rotation]) {
        return this.glyphs[font][rotation];
    }
    else if (font && this.glyphs[font]) {
        return this.glyphs[font];
    }
    return {};
}

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
    if (!text) return;

    this.renderGlyphs(_.uniq(_.difference(text.split(''), _.keys(this.getGlyph(font, rotation)))), font, false);
    
    var rotation = 0, xOffset = 0;
    for (var i = 0; i < text.length; i++) {
        var c = this.getGlyph(font, rotation, text[i]);
        if (c) {
            xOffset += this.drawGlyph(c, x, y, xOffset);
        }
        else {
            console.warn('Unknown glyph ' + text[i]);
        }
    }
};

LabelTexture.prototype.bind = function(painter) {
    if (this.glTexture) {
        return true;
    }
    var gl = painter.gl;

    this.glTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

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
}
