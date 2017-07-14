'use strict';

module.exports = GridIndex;

var NUM_PARAMS = 3;

function GridIndex(extent, n, padding) {
    var cells = this.cells = [];

    this.d = n + 2 * padding;
    for (var i = 0; i < this.d * this.d; i++) {
        cells.push([]);
    }
    this.keys = [];
    this.bboxes = [];

    this.n = n;
    this.extent = extent;
    this.padding = padding;
    this.scale = n / extent;
    this.uid = 0;

    var p = (padding / n) * extent;
    this.min = -p;
    this.max = extent + p;
}


GridIndex.prototype.insert = function(key, x1, y1, x2, y2) {
    this._forEachCell(x1, y1, x2, y2, this._insertCell, this.uid++);
    this.keys.push(key);
    this.bboxes.push(x1);
    this.bboxes.push(y1);
    this.bboxes.push(x2);
    this.bboxes.push(y2);
};

GridIndex.prototype._insertCell = function(x1, y1, x2, y2, cellIndex, uid) {
    this.cells[cellIndex].push(uid);
};

GridIndex.prototype._query = function(x1, y1, x2, y2, hitTest) {
    var min = this.min;
    var max = this.max;
    if (x2 < 0 || x1 > this.extent || y2 < 0 || y1 > this.extent) {
        return;
    }
    if (x1 <= min && y1 <= min && max <= x2 && max <= y2) {
        // We use `Array#slice` because `this.keys` may be a `Int32Array` and
        // some browsers (Safari and IE) do not support `TypedArray#slice`
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/slice#Browser_compatibility
        return Array.prototype.slice.call(this.keys);

    } else {
        var result = [];
        var seenUids = {};
        this._forEachCell(x1, y1, x2, y2, hitTest ? this._hitTestCell : this._queryCell, result, seenUids);
        return hitTest ? result.length > 0 : result;
    }
};

GridIndex.prototype.query = function(x1, y1, x2, y2) {
    return this._query(x1, y1, x2, y2, false);
}

GridIndex.prototype.hitTest = function(x1, y1, x2, y2) {
    return this._query(x1, y1, x2, y2, true);
}

GridIndex.prototype._hitTestCell = function(x1, y1, x2, y2, cellIndex, result, seenUids) {
    var cell = this.cells[cellIndex];
    if (cell !== null) {
        var bboxes = this.bboxes;
        for (var u = 0; u < cell.length; u++) {
            var offset = cell[u] * 4;
            if ((x1 <= bboxes[offset + 2]) &&
                (y1 <= bboxes[offset + 3]) &&
                (x2 >= bboxes[offset + 0]) &&
                (y2 >= bboxes[offset + 1])) {
                result.push(true);
                return true;
            }
        }
    }
};

GridIndex.prototype._queryCell = function(x1, y1, x2, y2, cellIndex, result, seenUids) {
    var cell = this.cells[cellIndex];
    if (cell !== null) {
        var keys = this.keys;
        var bboxes = this.bboxes;
        for (var u = 0; u < cell.length; u++) {
            var uid = cell[u];
            if (seenUids[uid] === undefined) {
                var offset = uid * 4;
                if ((x1 <= bboxes[offset + 2]) &&
                    (y1 <= bboxes[offset + 3]) &&
                    (x2 >= bboxes[offset + 0]) &&
                    (y2 >= bboxes[offset + 1])) {
                    seenUids[uid] = true;
                    result.push(keys[uid]);
                } else {
                    seenUids[uid] = false;
                }
            }
        }
    }
};

GridIndex.prototype._forEachCell = function(x1, y1, x2, y2, fn, arg1, arg2) {
    var cx1 = this._convertToCellCoord(x1);
    var cy1 = this._convertToCellCoord(y1);
    var cx2 = this._convertToCellCoord(x2);
    var cy2 = this._convertToCellCoord(y2);

    for (var x = cx1; x <= cx2; x++) {
        for (var y = cy1; y <= cy2; y++) {
            var cellIndex = this.d * y + x;
            if (fn.call(this, x1, y1, x2, y2, cellIndex, arg1, arg2)) return;
        }
    }
};

GridIndex.prototype._convertToCellCoord = function(x) {
    return Math.max(0, Math.min(this.d - 1, Math.floor(x * this.scale) + this.padding));
};
