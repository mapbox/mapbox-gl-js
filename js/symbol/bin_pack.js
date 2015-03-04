'use strict';

module.exports = BinPack;
function BinPack(width, height) {
    this.width = width;
    this.height = height;
    this.free = [{ x: 0, y: 0, w: width, h: height }];
}

BinPack.prototype.release = function(rect) {
    // Simple algorithm to recursively merge the newly released cell with its
    // neighbor. This doesn't merge more than two cells at a time, and fails
    // for complicated merges.
    for (var i = 0; i < this.free.length; i++) {
        var free = this.free[i];

        if (free.y === rect.y && free.h === rect.h && free.x + free.w === rect.x) {
            free.w += rect.w;

        } else if (free.x === rect.x && free.w === rect.w && free.y + free.h === rect.y) {
            free.h += rect.h;

        } else if (rect.y === free.y && rect.h === free.h && rect.x + rect.w === free.x) {
            free.x = rect.x;
            free.w += rect.w;

        } else if (rect.x === free.x && rect.w === free.w && rect.y + rect.h === free.y) {
            free.y = rect.y;
            free.h += rect.h;

        } else continue;

        this.free.splice(i, 1);
        this.release(free);
        return;

    }
    this.free.push(rect);
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
    }

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
};
