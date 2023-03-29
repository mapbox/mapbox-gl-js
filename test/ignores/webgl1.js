const todo = [
];

// Tests not supported on WebGL 1
const skip = [
    "render-tests/lighting-3d-mode/shadow/fill-extrusion",
    "render-tests/lighting-3d-mode/shadow/fill-extrusion-vertical-scale",
    "render-tests/model-layer/lighting-3d-mode/model-shadow",
    "render-tests/model-layer/ground-shadow-fog"
];

export default {todo, skip};
