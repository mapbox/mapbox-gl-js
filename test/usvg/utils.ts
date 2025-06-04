export const scales = [0.5, 1, 2];

export const formatScale = (s: number) => s.toFixed(1).replace('.', '_');
export const formatName = (name: string, scale: number) => `${name}_scale_${formatScale(scale)}`;

export const allowed = {
    'painting_marker_marker-on-line': {
        1: 0.008425
    },
    'painting_marker_orient=auto-on-M-L-L-Z-Z-Z': {
        0.5: 0.0013
    },
    'painting_shape-rendering_inheritance': {
        0.5: 0.0069
    },
    'painting_shape-rendering_on-horizontal-line': {
        0.5: 0.0158
    },
    'painting_stroke-width_default': {
        1.0: 0.0239
    },
    'shapes_line_simple-case': {
        0.5: 0.0138,
        1.0: 0.00705
    },
    'shapes_polygon_simple-case': {
        0.5: 0.0085
    },
    'shapes_polyline_ignore-odd-points': {
        0.5: 0.0082
    },
    'shapes_polyline_simple-case': {
        0.5: 0.0082
    },
    'shapes_polyline_stop-processing-on-invalid-data': {
        0.5: 0.0082
    }
};

export const ignores = [
    // not supported in usvg_pb
    "masking_clipPath_clip-path-with-transform-on-text",
    "masking_clipPath_clipping-with-complex-text-1",
    "masking_clipPath_clipping-with-complex-text-2",
    "masking_clipPath_clipping-with-complex-text-and-clip-rule",
    "masking_clipPath_clipping-with-text",
    "painting_context_with-text",
    "painting_display_none-on-tref",
    "painting_display_none-on-tspan-1",
    "painting_display_none-on-tspan-2",
    "painting_fill_linear-gradient-on-text",
    "painting_fill_pattern-on-text",
    "painting_fill_radial-gradient-on-text",
    "painting_fill-opacity_on-text",
    "painting_image-rendering_on-feImage",
    "painting_isolation_as-property",
    "painting_marker_marker-on-text",
    "painting_marker_with-a-text-child",
    "painting_marker_with-an-image-child",
    "painting_mix-blend-mode_color-burn",
    "painting_mix-blend-mode_color-dodge",
    "painting_mix-blend-mode_color",
    "painting_mix-blend-mode_darken",
    "painting_mix-blend-mode_difference",
    "painting_mix-blend-mode_exclusion",
    "painting_mix-blend-mode_hue",
    "painting_mix-blend-mode_lighten",
    "painting_mix-blend-mode_luminosity",
    "painting_mix-blend-mode_multiply",
    "painting_mix-blend-mode_opacity-on-element",
    "painting_mix-blend-mode_overlay",
    "painting_mix-blend-mode_saturation",
    "painting_mix-blend-mode_screen",
    "painting_mix-blend-mode_soft-light",
    "painting_paint-order_on-text",
    "painting_paint-order_on-tspan",
    "painting_shape-rendering_optimizeSpeed-on-text",
    "painting_stroke_linear-gradient-on-text",
    "painting_stroke_pattern-on-text",
    "painting_stroke_radial-gradient-on-text",
    "painting_stroke-opacity_on-text",
    "painting_visibility_bbox-impact-3",
    "painting_visibility_collapse-on-tspan",
    "painting_visibility_hidden-on-tspan",
    "painting-stroke-linejoin-miter-clip",
    "paint-servers_pattern_attributes-via-xlink-href",
    "paint-servers_pattern_children-via-xlink-href",
    "paint-servers_pattern_display=none-on-child",
    "paint-servers_pattern_everything-via-xlink-href",
    "paint-servers_pattern_invalid-patternUnits-and-patternContentUnits",
    "paint-servers_pattern_nested-objectBoundingBox",
    "paint-servers_pattern_out-of-order-referencing",
    "paint-servers_pattern_pattern-on-child",
    "paint-servers_pattern_patternContentUnits-with-viewBox",
    "paint-servers_pattern_patternContentUnits=objectBoundingBox",
    "paint-servers_pattern_patternUnits=objectBoundingBox",
    "paint-servers_pattern_patternUnits=objectBoundingBox-with-percent",
    "paint-servers_pattern_patternUnits=userSpaceOnUse-with-percent",
    "paint-servers_pattern_preserveAspectRatio",
    "paint-servers_pattern_recursive-on-child",
    "paint-servers_pattern_self-recursive",
    "paint-servers_pattern_self-recursive-on-child",
    "paint-servers_pattern_simple-case",
    "paint-servers_pattern_text-child",
    "paint-servers_pattern_tiny-pattern-upscaled",
    "paint-servers_pattern_transform-and-patternTransform",
    "paint-servers_pattern_viewBox-via-xlink-href",
    "paint-servers_pattern_with-patternTransform",
    "paint-servers_pattern_with-viewBox",
    "paint-servers_pattern_with-x-and-y",
    "painting_context_with-pattern-and-transform-in-use",
    "painting_context_with-pattern-in-use",
    "painting_context_with-pattern-objectBoundingBox-in-use",
    "painting_context_with-pattern-on-marker",
    "painting_fill_pattern-on-shape",
    "painting_fill-opacity_with-pattern",
    "painting_stroke_pattern",
    "painting_stroke-opacity_with-pattern",
    "masking_mask_with-grayscale-image", // embedded images
    "masking_mask_with-image",
    "painting_image-rendering_optimizeSpeed",
    "painting_image-rendering_optimizeSpeed-on-SVG",

    // spreadMethod not yet implemented
    "paint-servers_linearGradient_attributes-via-xlink-href-complex-order",
    "paint-servers_linearGradient_attributes-via-xlink-href-from-radialGradient",
    "paint-servers_linearGradient_spreadMethod=reflect",
    "paint-servers_linearGradient_spreadMethod=repeat",
    "paint-servers_radialGradient_attributes-via-xlink-href-complex-order",
    "paint-servers_radialGradient_attributes-via-xlink-href-from-linearGradient",
    "paint-servers_radialGradient_spreadMethod=reflect",
    "paint-servers_radialGradient_spreadMethod=repeat",

    // orientation on the marker here is different from expected image but still correct
    // https://github.com/linebender/resvg-test-suite/issues/46#issuecomment-1741979205
    "painting_marker_orient=auto-on-M-C-C-4",

    // difference in SVG and Canvas bezier renderers https://jsfiddle.net/Mourner/ub8twnhd/9/
    "painting_stroke_line-as-curve-2",

    // needs investigation
    "painting_marker_recursive-5",
];
