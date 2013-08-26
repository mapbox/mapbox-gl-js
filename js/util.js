function rotate(a, v) { return [ Math.cos(a)*v[0]-Math.sin(a)*v[1], Math.sin(a)*v[0]+Math.cos(a)*v[1] ]; };

function clamp(value, min, max) {
    return value < min ? min : (value > max ? max : value);
}
