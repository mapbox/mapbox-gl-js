const todo = [
    // These tests pass on deveolpment MacOS machines and on Linux CI runs
    // but fail on the  Mac virtual machine on CI

    // Inconsistent fill extrusion pattern placement
    "render-tests/fill-extrusion-pattern/2x-on-1x-add-image-dds",
    "render-tests/fill-extrusion-pattern/feature-expression",
    "render-tests/fill-extrusion-pattern/function",
    "render-tests/fill-extrusion-pattern/function-2",
    "render-tests/fill-extrusion-pattern/literal",
    "render-tests/fill-extrusion-pattern/opacity",
    "render-tests/fill-extrusion-pattern/opacity-terrain-flat",
    "render-tests/fog/2d/fill-extrusion-pattern",

    // Stars
    "render-tests/fog/globe/space-color-opacity",

    // Missing globe
    "render-tests/fog/set-fog-default-toggling",
    "render-tests/fog/switch-style-disable ",

];
const skip = [];

export default {todo, skip};
