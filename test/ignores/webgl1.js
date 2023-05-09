const todo = [
];

// Tests not supported on WebGL 1
const skip = [
    "render-tests/lighting-3d-mode/shadow/fill-extrusion",
    "render-tests/lighting-3d-mode/shadow/fill-extrusion-vertical-scale",
    "render-tests/model-layer/lighting-3d-mode/model-shadow",
    "render-tests/model-layer/ground-shadow-fog",
    "render-tests/model-layer/landmark-mbx",
    "render-tests/model-layer/landmark-mbx-shadows",
    "render-tests/model-layer/landmark-emission-strength",
    "render-tests/model-layer/landmark-part-styling-munich-museum",
    "render-tests/model-layer/landmark-part-styling-roughness",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/zero-radius",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/saturation",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/transparency",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/with-ao",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/edge-radius",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/fog",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/interior",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/zero-height",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/fixed-height",
    "render-tests/lighting-3d-mode/fill-extrusion/flood-light/floating-base",

    // Orthographic camera projection tests with shadows
    "render-tests/model-layer/camera-projection/with-shadows/camera-orthographic-high-pitch",
    "render-tests/model-layer/camera-projection/with-shadows/camera-orthographic-low-pitch",
    "render-tests/model-layer/camera-projection/with-shadows/camera-orthographic-terrain-zero-pitch",
    "render-tests/model-layer/camera-projection/with-shadows/camera-orthographic-text",
    "render-tests/model-layer/camera-projection/with-shadows/camera-orthographic-viewport-padding",
    "render-tests/model-layer/camera-projection/with-shadows/camera-orthographic-zero-pitch",
];

export default {todo, skip};
