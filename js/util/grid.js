'use strict';

module.exports = Grid;

var NUM_PARAMS = 3;

function Grid(n, extent, padding) {
    var cells = this.cells = [];

    if (n instanceof ArrayBuffer) {
        var array = new Int32Array(n);
        n = array[0];
        extent = array[1];
        padding = array[2];

        this.d = n + 2 * padding;
        for (var k = 0; k < this.d * this.d; k++) {
            cells.push(array.subarray(array[NUM_PARAMS + k], array[NUM_PARAMS + k + 1]));
        }
        var keysOffset = array[NUM_PARAMS + cells.length];
        var bboxesOffset = array[NUM_PARAMS + cells.length + 1];
        this.keys = array.subarray(keysOffset, bboxesOffset);
        this.bboxes = array.subarray(bboxesOffset);
    } else {
        this.d = n + 2 * padding;
        for (var i = 0; i < this.d * this.d; i++) {
            cells.push([]);
        }
        this.keys = [];
        this.bboxes = [];
    }

    this.n = n;
    this.extent = extent;
    this.padding = padding;
    this.scale = n / extent;
    this.uid = 0;
}


Grid.prototype.insert = function(bbox, key) {
    this._forEachCell(bbox, this._insertCell, this.uid++);
    this.keys.push(key);
    this.bboxes.push(bbox[0]);
    this.bboxes.push(bbox[1]);
    this.bboxes.push(bbox[2]);
    this.bboxes.push(bbox[3]);
};

Grid.prototype._insertCell = function(bbox, cellIndex, uid) {
    this.cells[cellIndex].push(uid);
};

Grid.prototype.query = function(bbox) {
    var result = [];
    var seenUids = {};
    this._forEachCell(bbox, this._queryCell, result, seenUids);
    return result;
};

Grid.prototype._queryCell = function(bbox, cellIndex, result, seenUids) {
    var cell = this.cells[cellIndex];
    var keys = this.keys;
    var bboxes = this.bboxes;
    for (var u = 0; u < cell.length; u++) {
        var uid = cell[u];
        if (seenUids[uid] === undefined) {
            var offset = uid * 4;
            if ((bbox[0] <= bboxes[offset + 2]) &&
                (bbox[1] <= bboxes[offset + 3]) &&
                (bbox[2] >= bboxes[offset + 0]) &&
                (bbox[3] >= bboxes[offset + 1])) {
                seenUids[uid] = true;
                result.push(keys[uid]);
            } else {
                seenUids[uid] = false;
            }
        }
    }
};

Grid.prototype._forEachCell = function(bbox, fn, arg1, arg2) {
    var x1 = this._convertToCellCoord(bbox[0]);
    var y1 = this._convertToCellCoord(bbox[1]);
    var x2 = this._convertToCellCoord(bbox[2]);
    var y2 = this._convertToCellCoord(bbox[3]);
    for (var x = x1; x <= x2; x++) {
        for (var y = y1; y <= y2; y++) {
            var cellIndex = this.d * y + x;
            if (fn.call(this, bbox, cellIndex, arg1, arg2)) return;
        }
    }
};

Grid.prototype._convertToCellCoord = function(x) {
    return Math.max(0, Math.min(this.d - 1, Math.floor(x * this.scale) + this.padding));
};

Grid.prototype.toArrayBuffer = function() {
    var cells = this.cells;

    var metadataLength = NUM_PARAMS + this.cells.length + 1 + 1;
    var totalCellLength = 0;
    for (var i = 0; i < this.cells.length; i++) {
        totalCellLength += this.cells[i].length;
    }

    var array = new Int32Array(metadataLength + totalCellLength + this.keys.length + this.bboxes.length);
    array[0] = this.n;
    array[1] = this.extent;
    array[2] = this.padding;

    var offset = metadataLength;
    for (var k = 0; k < cells.length; k++) {
        var cell = cells[k];
        array[NUM_PARAMS + k] = offset;
        array.set(cell, offset);
        offset += cell.length;
    }

    array[NUM_PARAMS + cells.length] = offset;
    array.set(this.keys, offset);
    offset += this.keys.length;

    array[NUM_PARAMS + cells.length + 1] = offset;
    array.set(this.bboxes, offset);
    offset += this.bboxes.length;

    return array.buffer;
};
