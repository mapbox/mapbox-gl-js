function BinPack(width, height) {
    this.width = width;
    this.height = height;
    this.free = [{ x: 0, y: 0, w: width, h: height }];
    this.index = {};
}

BinPack.prototype.release = function(rect) {
    this.free.push({ x: rect.x, y: rect.y, w: width, h: height });
    // TODO: Try to merge with neighboring segments?
};

BinPack.prototype.allocate = function(width, height) {
    // Find the smallest free rect angle
    var rect = { x: Infinity, y: Infinity, w: Infinity, h: Infinity };
    var smallest = -1;
    for (var i = 0; i < this.free.length; i++) {
        var ref = this.free[i];
        if (width <= ref.w && height <= ref.h && ref.y <= rect.y && ref.x <= rect.x) {
            rect = ref;
            smallest = i;
        }
    }

    if (smallest < 0) {
        // There's no space left for this char.
        return { x: -1, y: -1 };
    } else {
        this.free.splice(smallest, 1);

        // Shorter/Longer Axis Split Rule (SAS)
        // http://clb.demon.fi/files/RectangleBinPack.pdf p. 15
        // Ignore the dimension of R and just split long the shorter dimension
        // See Also: http://www.cs.princeton.edu/~chazelle/pubs/blbinpacking.pdf
        if (rect.w < rect.h) {
            // split horizontally
            // +--+---+
            // |__|___|  <-- b1
            // +------+  <-- b2
            if (rect.w > width) this.free.push({ x: rect.x + width, y: rect.y, w: rect.w - width, h: height });
            if (rect.h > height) this.free.push({ x: rect.x, y: rect.y + height, w: rect.w, h: rect.h - height });
        } else {
            // split vertically
            // +--+---+
            // |__|   | <-- b1
            // +--|---+ <-- b2
            if (rect.w > width) this.free.push({ x: rect.x + width, y: rect.y, w: rect.w - width, h: rect.h });
            if (rect.h > height) this.free.push({ x: rect.x, y: rect.y + height, w: width, h: rect.h - height });
        }

        return { x: rect.x, y: rect.y, w: width, h: height };
    }
};
