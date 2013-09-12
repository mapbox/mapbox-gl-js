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



function normal(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var c = Math.sqrt(dx * dx + dy * dy);
    return { x: dx / c, y: dy / c };
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
    var start = +new Date(),
        till = start + dur;

    function tick() {
        var now = +new Date();
        if (now > till) return fn(1);
        fn((now - start) / dur);
        frame(tick);
    }

    frame(tick);
}

function interp(a, b, t) {
    return (a * (1 - t)) + (b * t);
}
