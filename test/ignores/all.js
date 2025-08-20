
/**
 * NOTE: When skipping a GL JS test, it also needs to be skipped in Native at projects/gl-native/metrics/ignores/platform-all.json
 */

const todo = [
    // "https://github.com/mapbox/mapbox-gl-js/issues/2716
    "query-tests/regressions/mapbox-gl-js#4494",
    // To be ported: https://mapbox.atlassian.net/browse/GLJS-892
    "query-tests/symbol/above-horizon",

    // https://github.com/mapbox/mapbox-gl-js/issues/5649,
    "render-tests/map-mode/static",

    // "current behavior conflicts with https://github.com/mapbox/mapbox-gl-js/pull/6803. can be fixed when https://github.com/mapbox/api-maps/issues/1480 is done"
    "render-tests/mixed-zoom/z10-z11",

    // "axonometric rendering in gl-js tbd"
    "render-tests/projection/axonometric",
    "render-tests/projection/axonometric-multiple",
    "render-tests/projection/skew",

    // https://github.com/mapbox/mapbox-gl-js/issues/9161
    "render-tests/text-size/zero",

    // https://github.com/mapbox/mapbox-gl-js/issues/7023
    "render-tests/within/paint-line",

    // Needs port from Native
    // "https://github.com/mapbox/mapbox-gl-js/issues/10365"
    "render-tests/terrain/symbol-draping/style.json",

    // Requires complete landmark rendering support such as shadows and materials
    "render-tests/model-layer/landmark-conflation-buckingham",

    // https://mapbox.atlassian.net/browse/MAPS3D-987
    "render-tests/model-layer/landmark-shadows-terrain",

    // https://mapbox.atlassian.net/browse/GLJS-1005
    "expression-tests/image/two-arguments/available",
    "render-tests/image-fallback-nested/add-image-after",

    // Known issues with the elevated lines implementation
    // https://github.com/mapbox/mapbox-gl-js-internal/pull/1909
    "render-tests/elevated-line/join-none",
    "render-tests/elevated-line/join-linear-elevation",
    // z-fighting issues
    "render-tests/elevated-line-sort-key/literal",
    "render-tests/elevated-line-color/property-function",
    // Rendering issue at tile border
    "render-tests/elevated-line-translate/function",
    "render-tests/elevated-line-translate-anchor/map",
    "render-tests/elevated-line-translate-anchor/viewport-terrain",
    "render-tests/elevated-line-translate-anchor/viewport",
    // Globe projection not supported yet
    "render-tests/elevated-line-pattern-trim-offset/globe-end-offset",
    "render-tests/elevated-line-pattern-trim-offset/globe-mid-offset",
    "render-tests/elevated-line-pattern-trim-offset/globe-start-offset",
    // blur issues
    "render-tests/elevated-line-blur/high-pitch",
    "render-tests/elevated-line-blur/property-function",
    // border issues
    "render-tests/elevated-line-border/color",
    "render-tests/elevated-line-border/default",
    "render-tests/elevated-line-border/gradient",
    "render-tests/elevated-line-border/trim-offset",
    "render-tests/elevated-line-border/width",
    // opacity issues
    "render-tests/elevated-line-join/bevel-transparent",
    "render-tests/elevated-line-opacity/data-driven",
    "render-tests/elevated-line-opacity/multiple-layers",
    "render-tests/elevated-line-opacity/property-function",
    // possibly related to incorrect line progress values near line-joins and line-caps
    "render-tests/elevated-line-join/property-function-dasharray",
    "render-tests/elevated-line-pattern-trim-offset/end-offset",
    "render-tests/elevated-line-pattern-trim-offset/line-join-none-start-offset",
    "render-tests/elevated-line-pattern-trim-offset/mid-offset",
    "render-tests/elevated-line-pattern-trim-offset/shared-source",
    "render-tests/elevated-line-pattern-trim-offset/start-offset",
    "render-tests/elevated-line-pattern/line-join-none-fract-zoom",
    "render-tests/elevated-line-trim-offset/gradient-end-offset",
    "render-tests/elevated-line-trim-offset/gradient-mid-offset",
    "render-tests/elevated-line-trim-offset/gradient-round-cap",
    "render-tests/elevated-line-trim-offset/gradient-shared-source",
    "render-tests/elevated-line-trim-offset/gradient-start-offset",
    "render-tests/elevated-line-trim-offset/gradient-step",
    "render-tests/elevated-line-trim-offset/gradient-with-dash",
    "render-tests/elevated-line-trim-offset/pure-color-end-offset",
    "render-tests/elevated-line-trim-offset/pure-color-mid-offset",
    "render-tests/elevated-line-trim-offset/pure-color-round-cap",
    "render-tests/elevated-line-trim-offset/pure-color-shared-source",
    "render-tests/elevated-line-trim-offset/pure-color-start-offset",
    "render-tests/elevated-line-trim-offset/pure-color-with-dash",
    "render-tests/elevated-line-trim-offset/trim-color-fade",
    "render-tests/elevated-line-gradient/gradient-shared-source",
    "render-tests/elevated-line-gradient/gradient-step",
    "render-tests/elevated-line-gradient/gradient-with-dash",
    "render-tests/elevated-line-gradient/gradient",
    "render-tests/elevated-line-gradient/translucent",
    // pattern issues
    "render-tests/elevated-line-pattern/line-join-none-runtime-pattern",
    "render-tests/elevated-line-pattern/line-join-none-with-offset",
    "render-tests/elevated-line-pattern/line-join-none",
    "render-tests/elevated-line-pattern/overscaled",
    // line-width projected
    "render-tests/elevated-line-width/projected",
    // https://mapbox.atlassian.net/browse/MAPSNAT-2636
    "render-tests/icon-text-fit/stretch-nine-part-content-interpolate-text-size",
    // https://mapbox.atlassian.net/browse/GLJS-1189
    "render-tests/background-pattern/image-update/delayed/same-size-before-color-theme-change"
];

const skip = [
    // Pattern should be seamless across tile edges
    // https://github.com/mapbox/mapbox-gl-js/issues/11221
    "render-tests/background-pattern/projected",
    "render-tests/fill-pattern/projected",

    // Needs baseline update
    "query-tests/globe/circle/opposite-side-over-north-pole",

    // inconsistent text rendering with canvas on different platforms
    "render-tests/debug/tile",
    "render-tests/debug/tile-overscaled",

    // "skip - non-deterministic on AMD graphics cards
    "render-tests/fill-extrusion-pattern/1.5x-on-1x-add-image",

    // Inconsistent fill extrusion height rendering across tile boundaries
    // https://github.com/mapbox/mapbox-gl-js/issues/10181
    "render-tests/fill-extrusion-pattern/multiple-layers-flat",
    "render-tests/fill-extrusion-pattern/opacity-terrain-flat-on-border",

    // Not rendering correctly on CI
    "render-tests/fill-extrusion-pattern/tile-buffer",

    // Current behavior is arbitrary
    "render-tests/geojson/inline-linestring-fill",

    // Mapbox-gl-js does not support tile-mode
    "render-tests/icon-text-fit/text-variable-anchor-tile-map-mode",
    "render-tests/map-mode/tile",
    "render-tests/map-mode/tile-avoid-edges",
    "render-tests/symbol-placement/line-center-buffer-tile-map-mode",
    "render-tests/symbol-placement/line-center-tile-map-mode",
    "render-tests/text-variable-anchor/all-anchors-labels-priority-tile-map-mode",
    "render-tests/text-variable-anchor/all-anchors-tile-map-mode",
    "render-tests/text-variable-anchor/avoid-edges-tile-map-mode",
    "render-tests/text-variable-anchor/left-top-right-bottom-offset-tile-map-mode",
    "render-tests/tile-mode/streets-v11",

    // Non-deterministiic when rendered in browser
    "render-tests/text-variable-anchor/pitched-rotated-debug",
    "render-tests/text-variable-anchor/pitched-with-map",

    // Not sure this is correct behavior
    "render-tests/text-variable-anchor/remember-last-placement",

    // Flaky
    // https://github.com/mapbox/mapbox-gl-js/issues/10314"
    "render-tests/skybox/atmosphere-padding",

    // non-deterministic symbol placement on tile boundaries"
    "render-tests/text-variable-anchor/pitched",

    // Non-deterministic
    "query-tests/terrain/draped/lines/slope-occlusion-box-query",

    // Deferred for globe view
    "render-tests/fill-extrusion-pattern/opacity-terrain",

    // Pending globe view implementation
    "render-tests/globe/globe-transition/horizon-during-transition",

    // Implemented for mapbox-gl-native only
    "render-tests/resize/mercator",
    "render-tests/resize/globe",

    // Extremely flaky: https://github.com/mapbox/mapbox-gl-js/issues/11726
    "query-tests/terrain/draped/lines/slope-occlusion",

    // Unimplemented in -js:
    // https://mapbox.atlassian.net/browse/MAPS3D-671
    "render-tests/lighting-3d-mode/shadow/fill-extrusion-flat-roof",

    // fill-extrusion-rounded-roof not implemented in -js
    "render-tests/lighting-3d-mode/fill-extrusion/rounded-flat-roof",

    // https://mapbox.atlassian.net/browse/MAPS3D-1742
    "render-tests/model-layer/landmark-conflation-multiple-model-layers",

    // alpha textures not supported in -js
    "render-tests/model-layer/model-opacity-cutout-texture",
    // GLTF interleaved arrays not supported in -js
    "render-tests/model-layer/model-opacity-no-cutoff",

    // terrain model tests are flaky in CI
    "render-tests/model-layer/fill-extrusion--default-terrain-opacity",
    "render-tests/model-layer/fill-extrusion--default-terrain",

    // Conflation needs to be implemented first
    "render-tests/model-layer/landmark-part-styling-munich-museum",

    // Dithering of fog is always enabled in GL-JS
    "render-tests/fog/dithering-runtime-off",

    // Not implemented in gl-js
    "render-tests/fill-extrusion-partial-rendering/partial-rendering-0",
    "render-tests/fill-extrusion-partial-rendering/partial-rendering-1",
    "render-tests/fill-extrusion-partial-rendering/partial-rendering-2",
    "render-tests/fill-extrusion-partial-rendering/partial-rendering-3",

    // Flaky in CI, covered by unit tests
    "render-tests/terrain/camera-placement/elevation-not-yet-available",

    // Flaky, https://mapbox.atlassian.net/browse/GLJS-608
    "render-tests/model-layer/terrain-2-wheels-stunt",
    "render-tests/model-layer/multiple-models-terrain",

    // The algorithm for raster colour gradient texels stretching needs an adjustment
    "render-tests/raster-color/categorical",

    // Not working correctly
    // https://github.com/mapbox/mapbox-gl-js-internal/pull/1909
    "render-tests/lines-elevated-line-join-none",
    "render-tests/lines-elevated-line-joins-linear-elevation",

    // Support image updates with different size
    "render-tests/background-pattern/image-update/delayed/different-size",
    "render-tests/background-pattern/image-update/delayed/different-size-before-color-theme-change",
    "render-tests/background-pattern/image-update/delayed/different-size-with-color-theme",

    "render-tests/building/opacity",
    "render-tests/building/faux-facade/building-facade",
    "render-tests/building/faux-facade/building-facade-color-theme",
    "render-tests/building/faux-facade/emissive-chance",
    "render-tests/building/faux-facade/property-update",
    "render-tests/building/faux-facade/shadows-supported",
    "render-tests/building/faux-facade/skillion-unsupported",
    "render-tests/building/faux-facade/window-ao",
    "render-tests/building/faux-facade/building-facade-true-with-facade-hint",
    "render-tests/building/faux-facade/building-facade-true-without-facade-hint",
    "render-tests/building/faux-facade/feature-state",
    "render-tests/building/cutoff-fade",

    // https://mapbox.atlassian.net/browse/GLJS-1295
    "render-tests/placement/icon-optional",
    "render-tests/placement/text-optional/basic",
    "render-tests/placement/text-optional/text-variable-anchor",
    // limit number of holes experimental for native
    "render-tests/fill-limit-number-holes",

    // Needs updated model fixtures
    "render-tests/model-layer/landmark-conflation-border-overlapping-extrusion",
    "render-tests/model-layer/landmark-conflation-borders",
    "render-tests/model-layer/landmark-conflation-borders-add-layer",
    "render-tests/model-layer/landmark-conflation-borders-terrain",
    "render-tests/model-layer/landmark-conflation-multiple-model-layers",
    "render-tests/model-layer/landmark-shadows-terrain",
    "render-tests/model-layer/landmark-shadows-opacity",
    "render-tests/model-layer/landmark-terrain",
    "render-tests/model-layer/lighting-3d-mode/shadow",
    "render-tests/model-layer/landmark-conflation-multiple-sources",
    "render-tests/model-layer/landmark-shadow-skip-render",
    "render-tests/model-layer/landmark-multiple-model-layers-z-offset-hide-evaluated",
    "render-tests/model-layer/landmark-shadows-opacity-cutoff-range",
    "render-tests/model-layer/landmark-front-cutoff",
    "render-tests/model-layer/landmark-front-cutoff-disabled",
    "render-tests/model-layer/landmark-front-cutoff-no-fade",
    "render-tests/model-layer/landmark-front-cutoff-opacity",
    "render-tests/model-layer/landmark-front-cutoff-terrain",
    "render-tests/clip-layer/clip-layer-default-below-one-batched-model",

    // fill-extrusions always get removed. This will be separated (similar to symbol and model) in future.
    "render-tests/clip-layer/clip-layer-keep-fill-extrusions",
];

export default {todo, skip};
