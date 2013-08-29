// Rotate a vector (multiply the rotation transformation matrix by the vector).
function rotate(a, v) { return [ Math.cos(a) * v[0] - Math.sin(a) * v[1], Math.sin(a) * v[0] + Math.cos(a) * v[1] ]; };
// Subtract vector b from vector a.
function vectorSub(a, b) { return [a[0] - b[0], a[1] - b[1]] };
// Add vectors a and b.
function vectorAdd(a, b) { return [a[0] + b[0], a[1] + b[1]] };
// Take the magnitude of vector a.
function vectorMag(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1]) };
