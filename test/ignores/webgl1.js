const todo = [
];

// Tests not supported on WebGL 1
const skip = [
    "render-tests/lighting-3d-mode/shadow/fill-extrusion",
    "render-tests/lighting-3d-mode/shadow/fill-extrusion-vertical-scale",
    "render-tests/model-layer/lighting-3d-mode/model-shadow",
    "render-tests/model-layer/ground-shadow-fog",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/zero-radius",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/saturation",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/transparency",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/with-ao",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/edge-radius",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/fog",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/interior",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/zero-height"
];

export default {todo, skip};
