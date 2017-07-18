'use strict';

module.exports = GridIndex;

var NUM_PARAMS = 3;

function GridIndex(width, height, n) {
    var boxCells = this.boxCells = [];
    var circleCells = this.circleCells = [];

    for (var i = 0; i < n * n; i++) {
        boxCells.push([]);
        circleCells.push([]);
    }
    this.circleKeys = [];
    this.boxKeys = [];
    this.bboxes = [];
    this.circles = [];

    this.n = n;
    this.width = width;
    this.height = height;
    this.xScale = n / width;
    this.yScale = n / height;
    this.boxUid = 0;
    this.circleUid = 0;
}


GridIndex.prototype.insert = function(key, x1, y1, x2, y2) {
    this._forEachCell(x1, y1, x2, y2, this._insertBoxCell, this.boxUid++);
    this.boxKeys.push(key);
    this.bboxes.push(x1);
    this.bboxes.push(y1);
    this.bboxes.push(x2);
    this.bboxes.push(y2);
};

GridIndex.prototype.insertCircle = function(key, x, y, radius) {
    // TODO: Use some sort of circle rasterization algorithm here to avoid cells outside
    // the circle's radius. For now it's OK for us to just be conservative and check all
    // cells with the square that holds the circle
    var x1 = x - radius;
    var x2 = x + radius;
    var y1 = y - radius;
    var y2 = y + radius;
    this._forEachCell(x1, y1, x2, y2, this._insertCircleCell, this.circleUid++);
    this.circleKeys.push(key);
    this.circles.push(x);
    this.circles.push(y);
    this.circles.push(radius);
};

GridIndex.prototype._insertBoxCell = function(x1, y1, x2, y2, cellIndex, uid) {
    this.boxCells[cellIndex].push(uid);
};

GridIndex.prototype._insertCircleCell = function(x1, y1, x2, y2, cellIndex, uid) {
    this.circleCells[cellIndex].push(uid);
};

GridIndex.prototype._query = function(x1, y1, x2, y2, hitTest) {

    if (x2 < 0 || x1 > this.width || y2 < 0 || y1 > this.height) {
        return;
    }
    if (x1 <= 0 && y1 <= 0 && this.width <= x2 && this.height <= y2) {
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

GridIndex.prototype._queryCircle = function(x, y, radius, hitTest) {
    // TODO: Use some sort of circle rasterization algorithm here to avoid cells outside
    // the circle's radius. For now it's OK for us to just be conservative and check all
    // cells with the square that holds the circle
    var x1 = x - radius;
    var x2 = x + radius;
    var y1 = y - radius;
    var y2 = y + radius;
    if (x2 < 0 || x1 > this.width || y2 < 0 || y1 > this.height) {
        return;
    }
    if (x1 <= 0 && y1 <= 0 && this.width <= x2 && this.height <= y2) {
        // We use `Array#slice` because `this.keys` may be a `Int32Array` and
        // some browsers (Safari and IE) do not support `TypedArray#slice`
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/slice#Browser_compatibility
        return Array.prototype.slice.call(this.keys);

    } else {
        var result = [];
        var seenUids = {};
        this._forEachCell(x1, y1, x2, y2, hitTest ? this._hitTestCellCircle : this._queryCellCircle, result, { x: x, y: y, radius: radius });
        return hitTest ? result.length > 0 : result;
    }
};

GridIndex.prototype.query = function(x1, y1, x2, y2) {
    return this._query(x1, y1, x2, y2, false);
}

GridIndex.prototype.hitTest = function(x1, y1, x2, y2) {
    return this._query(x1, y1, x2, y2, true);
}

GridIndex.prototype.hitTestCircle = function(x, y, radius) {
    return this._queryCircle(x, y, radius, true);
}

function CirclesCollide(x1, y1, r1, x2, y2, r2, debug) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var bothRadii = r1 + r2;
    return (bothRadii * bothRadii) > (dx * dx + dy * dy);
}

function CircleAndRectCollide(x, y, radius, x1, y1, x2, y2) {
    // TODO: Lots of extra math here
    var circle = { x: x, y: y, r: radius };
    var rectWidth = x2 - x1;
    var rectHeight = y2 - y1;
    var rect = { x: x1, y: y1, w: rectWidth, h: rectHeight };
    var distX = Math.abs(circle.x - rect.x - rect.w / 2);
    var distY = Math.abs(circle.y - rect.y - rect.h / 2);

    if (distX > (rect.w / 2 + circle.r)) {
        return false;
    }
    if (distY > (rect.h / 2 + circle.r)) {
        return false;
    }

    if (distX <= (rect.w / 2)) {
        return true;
    }
    if (distY <= (rect.h / 2)) {
        return true;
    }

    var dx = distX - rect.w / 2;
    var dy = distY - rect.h / 2;
    return (dx * dx + dy * dy <= (circle.r * circle.r));
}


GridIndex.prototype._hitTestCell = function(x1, y1, x2, y2, cellIndex, result) {
    var boxCell = this.boxCells[cellIndex];
    if (boxCell !== null) {
        var bboxes = this.bboxes;
        for (var u = 0; u < boxCell.length; u++) {
            var offset = boxCell[u] * 4;
            if ((x1 <= bboxes[offset + 2]) &&
                (y1 <= bboxes[offset + 3]) &&
                (x2 >= bboxes[offset + 0]) &&
                (y2 >= bboxes[offset + 1])) {
                result.push(true);
                return true;
            }
        }
    }
    var circleCell = this.circleCells[cellIndex];
    if (circleCell !== null) {
        var circles = this.circles;
        for (var u = 0; u < circleCell.length; u++) {
            var offset = circleCell[u] * 3;
            if (CircleAndRectCollide(circles[offset],
                                     circles[offset + 1],
                                     circles[offset + 2],
                                     x1, y1, x2, y2)) {
                result.push(true);
                return true;
            }
        }
    }
};

GridIndex.prototype._hitTestCellCircle = function(x1, y1, x2, y2, cellIndex, result, circle) {
    var boxCell = this.boxCells[cellIndex];
    if (boxCell !== null) {
        var bboxes = this.bboxes;
        for (var u = 0; u < boxCell.length; u++) {
            var offset = boxCell[u] * 4;
            if (CircleAndRectCollide(circle.x, circle.y, circle.radius, bboxes[offset + 0], bboxes[offset + 1], bboxes[offset + 2], bboxes[offset + 3])) {
                result.push(true);
                return true;
            }
        }
    }

    var circleCell = this.circleCells[cellIndex];
    if (circleCell !== null) {
        var circles = this.circles;
        for (var u = 0; u < circleCell.length; u++) {
            var offset = circleCell[u] * 3;
            var keys = this.circleKeys;
            if (CirclesCollide(circles[offset],
                                     circles[offset + 1],
                                     circles[offset + 2],
                                     circle.x, circle.y, circle.radius)) {
                // console.log("Collided against: " + keys[circleCell[u]]);
                // console.log(`Placing: ${circle.x}, ${circle.y}, ${circle.radius} against ${circles[offset]}, ${circles[offset+1]}, ${circles[offset+2]}`);
                // CirclesCollide(circles[offset],
                //                          circles[offset + 1],
                //                          circles[offset + 2],
                //                          circle.x, circle.y, circle.radius, true);
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
    var cx1 = this._convertToXCellCoord(x1);
    var cy1 = this._convertToYCellCoord(y1);
    var cx2 = this._convertToXCellCoord(x2);
    var cy2 = this._convertToYCellCoord(y2);

    for (var x = cx1; x <= cx2; x++) {
        for (var y = cy1; y <= cy2; y++) {
            var cellIndex = this.n * y + x;
            if (fn.call(this, x1, y1, x2, y2, cellIndex, arg1, arg2)) return;
        }
    }
};

GridIndex.prototype._convertToXCellCoord = function(x) {
    return Math.max(0, Math.min(this.n - 1, Math.floor(x * this.xScale)));
};

GridIndex.prototype._convertToYCellCoord = function(y) {
    return Math.max(0, Math.min(this.n - 1, Math.floor(y * this.yScale)));
};
