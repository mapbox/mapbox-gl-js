// Rotate a vector (multiply the rotation transformation matrix by the vector).
function rotate(a, v) { return { x: Math.cos(a) * v.x - Math.sin(a) * v.y, y: Math.sin(a) * v.x + Math.cos(a) * v.y }; }
// Subtract vector b from vector a.
function vectorSub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
// Add vectors a and b.
function vectorAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
// Take the magnitude of vector a.
function vectorMag(a) { return Math.sqrt(a.x * a.x + a.y * a.y); }
// Find the angle of the two vectors. In this particular instance, I solve the formula for the
// cross product a x b = |a||b|sin(θ) for θ.
function angleBetween(a, b) { return Math.asin((a.x * b.y - a.y * b.x) / (vectorMag(a) * vectorMag(b))); }

function vectorMul(m, v) {
    return { x: m.a * v.x + m.b * v.y, y: m.c * v.x + m.d * v.y };
}

function distance_squared(a, b) {
    var p = a.x - b.x;
    var q = a.y - b.y;
    return p*p + q*q;
}

var PI_2 = Math.PI / 2;

function clamp_horizontal(angle) {
    return (angle + PI_2) % Math.PI - PI_2;
}

function line_center(a, b) {
    return { x: a.x + (b.x - a.x) / 2, y: a.y + (b.y - a.y) / 2 };
}

function unit(v) {
    var mag = vectorMag(v);
    return { x: v.x/mag, y: v.y/mag };
}

function normal(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var c = Math.sqrt(dx * dx + dy * dy);
    return { x: dx / c, y: dy / c };
}

function dist(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var c = Math.sqrt(dx * dx + dy * dy);
    return c;
}

function easeCubicInOut(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  var t2 = t * t, t3 = t2 * t;
  return 4 * (t < 0.5 ? t3 : 3 * (t - t2) + t3 - 0.75);
}

function frame(fn) {
    return (window.requestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.msRequestAnimationFrame)(fn);
}

function timed(fn, dur) {
    var start =  window.performance.now ?
        performance.now() : Date.now(),
        abort = false,
        till = start + dur;

    function tick(now) {
        if (abort) return;
        if (now > till) return fn(1);
        fn((now - start) / dur);
        frame(tick);
    }

    frame(tick);

    return function() {
        abort = true;
    };
}

function interp(a, b, t) {
    return (a * (1 - t)) + (b * t);
}

function async_each(array, fn, callback) {
    var remaining = array.length;
    if (remaining === 0) return callback();
    function check() { if (--remaining === 0) callback(); }
    for (var i = 0; i < array.length; i++) fn(array[i], check);
}
