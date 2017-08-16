'use strict';

module.exports = GridIndex;

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

GridIndex.prototype.keysLength = function() {
    return this.boxKeys.length + this.circleKeys.length;
};

GridIndex.prototype.insert = function(key, x1, y1, x2, y2) {
    this._forEachCell(x1, y1, x2, y2, this._insertBoxCell, this.boxUid++);
    this.boxKeys.push(key);
    this.bboxes.push(x1);
    this.bboxes.push(y1);
    this.bboxes.push(x2);
    this.bboxes.push(y2);
};

GridIndex.prototype.insertCircle = function(key, x, y, radius) {
    // Insert circle into grid for all cells in the circumscribing square
    // It's more than necessary (by a factor of 4/PI), but fast to insert
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
        return hitTest ? false : [];
    }
    var result = [];
    if (x1 <= 0 && y1 <= 0 && this.width <= x2 && this.height <= y2) {
        // We use `Array#slice` because `this.keys` may be a `Int32Array` and
        // some browsers (Safari and IE) do not support `TypedArray#slice`
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/slice#Browser_compatibility
        result = Array.prototype.slice.call(this.boxKeys).concat(this.circleKeys);
    } else {
        var seenUids = { box: {}, circle: {} };
        this._forEachCell(x1, y1, x2, y2, hitTest ? this._hitTestCell : this._queryCell, result, seenUids);
    }
    return hitTest ? result.length > 0 : result;
};

GridIndex.prototype._queryCircle = function(x, y, radius, hitTest) {
    // Insert circle into grid for all cells in the circumscribing square
    // It's more than necessary (by a factor of 4/PI), but fast to insert
    var x1 = x - radius;
    var x2 = x + radius;
    var y1 = y - radius;
    var y2 = y + radius;
    if (x2 < 0 || x1 > this.width || y2 < 0 || y1 > this.height) {
        return hitTest ? false : [];
    }

    // Box query early exits if the bounding box is larger than the grid, but we don't do
    // the equivalent calculation for circle queries because early exit is less likely
    // and the calculation is more expensive
    var result = [];
    var circleArgs = {
        circle: { x: x, y: y, radius: radius },
        seenUids: { box: {}, circle: {} } };
    this._forEachCell(x1, y1, x2, y2, hitTest ? this._hitTestCellCircle : this._queryCellCircle, result, circleArgs);
    return hitTest ? result.length > 0 : result;
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

function CirclesCollide(x1, y1, r1, x2, y2, r2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var bothRadii = r1 + r2;
    return (bothRadii * bothRadii) > (dx * dx + dy * dy);
}

function CircleAndRectCollide(x, y, radius, x1, y1, x2, y2) {
    var circle = { x: x, y: y, r: radius };

    var halfRectWidth = (x2 - x1) / 2;
    var distX = Math.abs(circle.x - (x1 + halfRectWidth));
    if (distX > (halfRectWidth + circle.r)) {
        return false;
    }

    var halfRectHeight = (y2 - y1) / 2;
    var distY = Math.abs(circle.y - (y1 + halfRectHeight));
    if (distY > (halfRectHeight + circle.r)) {
        return false;
    }

    if (distX <= halfRectWidth || distY <= halfRectHeight) {
        return true;
    }

    var dx = distX - halfRectWidth;
    var dy = distY - halfRectHeight;
    return (dx * dx + dy * dy <= (circle.r * circle.r));
}


GridIndex.prototype._hitTestCell = function(x1, y1, x2, y2, cellIndex, result, seenUids) {
    var boxCell = this.boxCells[cellIndex];
    if (boxCell !== null) {
        var bboxes = this.bboxes;
        for (var u = 0; u < boxCell.length; u++) {
            var boxUid = boxCell[u];
            if (!seenUids.box[boxUid]) {
                seenUids.box[boxUid] = true;
                var offset = boxUid * 4;
                if ((x1 <= bboxes[offset + 2]) &&
                    (y1 <= bboxes[offset + 3]) &&
                    (x2 >= bboxes[offset + 0]) &&
                    (y2 >= bboxes[offset + 1])) {
                    result.push(true);
                    return true;
                }
            }
        }
    }
    var circleCell = this.circleCells[cellIndex];
    if (circleCell !== null) {
        var circles = this.circles;
        for (var u = 0; u < circleCell.length; u++) {
            var circleUid = circleCell[u];
            if (!seenUids.circle[circleUid]) {
                seenUids.circle[circleUid] = true;
                var offset = circleUid * 3;
                if (CircleAndRectCollide(circles[offset],
                                         circles[offset + 1],
                                         circles[offset + 2],
                                         x1, y1, x2, y2)) {
                    result.push(true);
                    return true;
                }
            }
        }
    }
};

GridIndex.prototype._hitTestCellCircle = function(x1, y1, x2, y2, cellIndex, result, circleArgs) {
    var circle = circleArgs.circle;
    var seenUids = circleArgs.seenUids;
    var boxCell = this.boxCells[cellIndex];
    if (boxCell !== null) {
        var bboxes = this.bboxes;
        for (var u = 0; u < boxCell.length; u++) {
            var boxUid = boxCell[u];
            if (!seenUids.box[boxUid]) {
                seenUids.box[boxUid] = true;
                var offset = boxUid * 4;
                if (CircleAndRectCollide(circle.x, circle.y, circle.radius, bboxes[offset + 0], bboxes[offset + 1], bboxes[offset + 2], bboxes[offset + 3])) {
                    result.push(true);
                    return true;
                }
            }
        }
    }

    var circleCell = this.circleCells[cellIndex];
    if (circleCell !== null) {
        var circles = this.circles;
        for (var u = 0; u < circleCell.length; u++) {
            var circleUid = circleCell[u];
            if (!seenUids.circle[circleUid]) {
                seenUids.circle[circleUid] = true;
                var offset = circleUid * 3;
                var keys = this.circleKeys;
                if (CirclesCollide(circles[offset],
                                         circles[offset + 1],
                                         circles[offset + 2],
                                         circle.x, circle.y, circle.radius)) {
                    result.push(true);
                    return true;
                }
            }
        }
    }
};

GridIndex.prototype._queryCell = function(x1, y1, x2, y2, cellIndex, result, seenUids) {
    var boxCell = this.boxCells[cellIndex];
    if (boxCell !== null) {
        var bboxes = this.bboxes;
        var boxKeys = this.boxKeys;
        for (var u = 0; u < boxCell.length; u++) {
            var boxUid = boxCell[u];
            if (!seenUids.box[boxUid]) {
                seenUids.box[boxUid] = true;
                var offset = boxUid * 4;
                if ((x1 <= bboxes[offset + 2]) &&
                    (y1 <= bboxes[offset + 3]) &&
                    (x2 >= bboxes[offset + 0]) &&
                    (y2 >= bboxes[offset + 1])) {
                    result.push(boxKeys[boxUid]);
                }
            }
        }
    }
    var circleCell = this.circleCells[cellIndex];
    if (circleCell !== null) {
        var circles = this.circles;
        var circleKeys = this.circleKeys;
        for (var u = 0; u < circleCell.length; u++) {
            var circleUid = circleCell[u];
            if (!seenUids.circle[circleUid]) {
                var offset = circleUid * 3;
                seenUids.circle[circleUid] = true;
                if (CircleAndRectCollide(circles[offset],
                                         circles[offset + 1],
                                         circles[offset + 2],
                                         x1, y1, x2, y2)) {
                    result.push(true);
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
