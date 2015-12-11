'use strict';

module.exports = BinPack;

/**
 * Simple Bin Packing
 * Uses the Shelf Best Height Fit algorithm from
 * http://clb.demon.fi/files/RectangleBinPack.pdf
 * @private
 */
function BinPack(width, height) {
    this.width = width;
    this.height = height;
    this.shelves = [];
    this.stats = {};
    this.count = function(h) {
        this.stats[h] = (this.stats[h] | 0) + 1;
    };
}

BinPack.prototype.allocate = function(reqWidth, reqHeight) {
    var y = 0,
        best = { shelf: -1, waste: Infinity },
        shelf, waste;

    // find shelf
    for (var i = 0; i < this.shelves.length; i++) {
        shelf = this.shelves[i];
        y += shelf.height;

        // exactly the right height with width to spare, pack it..
        if (reqHeight === shelf.height && reqWidth <= shelf.free) {
            this.count(reqHeight);
            return shelf.alloc(reqWidth, reqHeight);
        }
        // not enough height or width, skip it..
        if (reqHeight > shelf.height || reqWidth > shelf.free) {
            continue;
        }
        // maybe enough height or width, minimize waste..
        if (reqHeight < shelf.height && reqWidth <= shelf.free) {
            waste = shelf.height - reqHeight;
            if (waste < best.waste) {
                best.waste = waste;
                best.shelf = i;
            }
        }
    }

    if (best.shelf !== -1) {
        shelf = this.shelves[best.shelf];
        this.count(reqHeight);
        return shelf.alloc(reqWidth, reqHeight);
    }

    // add shelf
    if (reqHeight <= (this.height - y) && reqWidth <= this.width) {
        shelf = new Shelf(y, this.width, reqHeight);
        this.shelves.push(shelf);
        this.count(reqHeight);
        return shelf.alloc(reqWidth, reqHeight);
    }

    // no more space
    return {x: -1, y: -1};
};


BinPack.prototype.resize = function(reqWidth, reqHeight) {
    if (reqWidth < this.width || reqHeight < this.height) { return false; }
    this.height = reqHeight;
    this.width = reqWidth;
    for (var i = 0; i < this.shelves.length; i++) {
        this.shelves[i].resize(reqWidth);
    }
    return true;
};


function Shelf(y, width, height) {
    this.y = y;
    this.x = 0;
    this.width = this.free = width;
    this.height = height;
}

Shelf.prototype = {
    alloc: function(reqWidth, reqHeight) {
        if (reqWidth > this.free || reqHeight > this.height) {
            return {x: -1, y: -1};
        }
        var x = this.x;
        this.x += reqWidth;
        this.free -= reqWidth;
        return {x: x, y: this.y, w: reqWidth, h: reqHeight};
    },

    resize: function(reqWidth) {
        if (reqWidth < this.width) { return false; }
        this.free += (reqWidth - this.width);
        this.width = reqWidth;
        return true;
    }
};

