// Rotate a vector (multiply the rotation transformation matrix by the vector).
function rotate(a, v) { return [ Math.cos(a) * v[0] - Math.sin(a) * v[1], Math.sin(a) * v[0] + Math.cos(a) * v[1] ]; }
// Subtract vector b from vector a.
function vectorSub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
// Add vectors a and b.
function vectorAdd(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
// Take the magnitude of vector a.
function vectorMag(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1]); }

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
