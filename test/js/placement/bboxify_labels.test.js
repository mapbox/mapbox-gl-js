'use strict';

var test = require('tape');
var bboxify = require('../../../js/placement/bboxify_labels');


test('getDistance', function(t) {

    var p0 = {x: 2, y: 2};
    var p1 = {x: 3, y: 3};

    var expected = Math.sqrt(2);

    var d = bboxify.getDistance(p0, p1);
    t.equal(d, expected);
    t.end();
});


test('line2polyline', function(t) {

    var cumulativeDistances = [0, 100, 150, 300];

    // point is -30 units w.r.t the 1st segment
    var linePoint0 = -30;
    var expectedPolylinePoint0 = {segment: 0, distance: -30};
    var polylinePoint0 = bboxify.line2polyline(cumulativeDistances, linePoint0);
    t.deepEqual(polylinePoint0, expectedPolylinePoint0);

    // point is 30 units w.r.t to the 2nd segment
    var linePoint1 = 130;
    var expectedPolylinePoint1 = {segment: 1, distance: 30};
    var polylinePoint1 = bboxify.line2polyline(cumulativeDistances, linePoint1);
    t.deepEqual(polylinePoint1, expectedPolylinePoint1);

// point is 30 units beyonds the last segment
var linePoint2 = 330;
var expectedPolylinePoint2 = {segment: 2, distance:180};
var polylinePoint2 = bboxify.line2polyline(cumulativeDistances, linePoint2);
t.deepEqual(polylinePoint2, expectedPolylinePoint2);

t.end();
});


test('line2polyline vertical', function(t) {

    var geom = [{"x":2202, "y":3325}, {"x":2202, "y":3314}, {"x":2202, "y":3267}, {"x":2202, "y":3216}, {"x":2202, "y":3160}];
    var cumulativeDistances = bboxify.getCumulativeDistances(geom);

    var linePoint = 30;
    var expectedPolylinePoint = {segment: 1, distance: 19};
    var polylinePoint = bboxify.line2polyline(cumulativeDistances, linePoint);

    t.deepEqual(polylinePoint, expectedPolylinePoint);
    t.end();
});

test('polyline2xy', function(t) {

    var points = [
{x: 10, y: 10},
{x: 30, y: 20},
{x: 70, y: 50}
];

var expected = {x: 46, y:32};
var polylinePoint = { segment: 1, distance: 20 };
var xy = bboxify.polyline2xy(points, polylinePoint);

t.deepEqual(xy, expected);
t.end();
});


test('bboxify should not return boxes in the same location', function(t) {

    var geom = [{"x":2202, "y":3325}, {"x":2202, "y":3314}, {"x":2202, "y":3267}, {"x":2202, "y":3216}, {"x":2202, "y":3160}];
    var anchor = {"x": 2202, "y": 3280, "segment": 1};
    var length = 17.30625;
    var height = 3.899999;

    var boxes = bboxify.bboxifyLabel(geom, anchor, length, height);

    // assert boxes are not in the same location
    for (var i = 0; i < boxes.length - 1; i++) {
        var b1 = boxes[i];
        var b2 = boxes[i + 1];

        var p1 = {x: b1.x, y:b1.y};
        var p2 = {x: b2.x, y:b2.y};

        t.notDeepEqual(p1, p2);
    }

    t.end();
});


test('bboxify should not return nans', function(t) {

    var geom = [ { x: 4039, y: -96 }, { x: 4040, y: -40 }, { x: 4040, y: -23 }, { x: 4040, y: -10 }, { x: 4040, y: 2 }, { x: 4039, y: 14 }, { x: 4038, y: 26 }, { x: 4037, y: 36 }, { x: 4035, y: 49 }, { x: 4032, y: 62 }, { x: 4029, y: 74 }, { x: 4027, y: 84 }, { x: 4023, y: 96 }, { x: 4015, y: 120 }, { x: 4008, y: 137 }, { x: 4002, y: 151 }, { x: 3993, y: 167 }, { x: 3985, y: 182 }, { x: 3977, y: 195 }, { x: 3969, y: 207 }, { x: 3954, y: 226 }, { x: 3934, y: 252 }, { x: 3917, y: 274 }, { x: 3904, y: 292 }, { x: 3893, y: 309 }, { x: 3883, y: 325 }, { x: 3875, y: 341 }, { x: 3867, y: 358 }, { x: 3858, y: 378 }, { x: 3851, y: 398 }, { x: 3845, y: 416 }, { x: 3840, y: 436 }, { x: 3835, y: 456 }, { x: 3832, y: 479 }, { x: 3830, y: 497 }, { x: 3829, y: 518 }, { x: 3828, y: 538 }, { x: 3829, y: 561 }, { x: 3831, y: 585 }, { x: 3839, y: 705 }, { x: 3840, y: 726 }, { x: 3840, y: 747 }, { x: 3840, y: 771 }, { x: 3839, y: 790 }, { x: 3837, y: 813 }, { x: 3834, y: 832 }, { x: 3830, y: 856 }, { x: 3827, y: 871 }, { x: 3821, y: 894 }, { x: 3816, y: 910 }, { x: 3810, y: 930 }, { x: 3801, y: 952 }, { x: 3791, y: 977 }, { x: 3782, y: 996 }, { x: 3774, y: 1013 }, { x: 3765, y: 1029 }, { x: 3755, y: 1046 }, { x: 3742, y: 1065 }, { x: 3736, y: 1073 }, { x: 3727, y: 1085 }, { x: 3718, y: 1096 }, { x: 3703, y: 1114 }, { x: 3683, y: 1137 }, { x: 3669, y: 1154 }, { x: 3656, y: 1171 }, { x: 3643, y: 1190 }, { x: 3633, y: 1206 }, { x: 3622, y: 1223 } ];
    var anchor = {
        segment: 38,
    x: 3838.1348281926157,
    y: 692.0224228892362
    };
var length = 1390.1333333333332;
var height = 124.79999999999998;

var boxes = bboxify.bboxifyLabel(geom, anchor, length, height);

for (var i = 0; i < boxes.length; i++) {
    var box = boxes[i];
    t.equal(false, isNaN(box.x));
    t.equal(false, isNaN(box.y));
}

t.end();
});
