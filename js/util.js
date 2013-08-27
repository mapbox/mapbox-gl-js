function rotate(a, v) { return [ Math.cos(a)*v[0]-Math.sin(a)*v[1], Math.sin(a)*v[0]+Math.cos(a)*v[1] ]; };
function vectorSub(a, b) { return [a[0]-b[0], a[1]-b[1]] }
function vectorMag(a) { return Math.sqrt(a[0]*a[0] + a[1]*a[1]) }

function clamp(value, min, max) {
    return value < min ? min : (value > max ? max : value);
}
