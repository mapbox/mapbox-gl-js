const todo = [
    // Inconsistencies with fill pattern. Some are visibly noticeable, others subtle.
    // Possibly nonodeterministic rendering.
    "render-tests/fill-extrusion-pattern/feature-expression",
    "render-tests/fill-extrusion-pattern/literal",
    "render-tests/fill-extrusion-pattern/opacity",
    "render-tests/fill-extrusion-pattern/@2x",
    "render-tests/fill-extrusion-pattern/2x-on-1x-add-image-dds",
    "render-tests/fill-extrusion-pattern/function",
    "render-tests/fill-extrusion-pattern/function-2",
    "render-tests/fill-extrusion-pattern/opacity-terrain-flat",

    // Inconsistent star placement
    "render-tests/globe/globe-default",
    "render-tests/globe/globe-transforms/low-lat-low-lng",
    "render-tests/globe/globe-transforms/north-pole",

    // Debug visualizations
    "render-tests/debug/raster",
    "render-tests/debug/collision-variable-icon-image-simple",
    "render-tests/terrain/wireframe",
    "render-tests/terrain/wireframe-high-exaggeration",

    // Looks good but diff is too high
    "render-tests/globe/globe-terrain",

    // Globe during transition is slightly offset.
    // Subtle enough to not be a problem, but diff is high.
    "render-tests/globe/globe-transition/bearing",

    // Inconsistent debug rendering
    "render-tests/custom-source/satellite"
];
const skip = [
    // Sometimes timing out
    "render-tests/globe/globe-video",
    "render-tests/video/default"

];

export default {todo, skip};
