uniform float u_zoom;
// u_maxzoom is derived from the maximum scale considered by the CollisionTile
// Labels with placement zoom greater than this value will not be placed,
// regardless of perspective effects.
uniform float u_maxzoom;
uniform sampler2D u_fadetexture;

// v_max_zoom is a collision-box-specific value that controls when line-following
// collision boxes are used.
varying float v_max_zoom;
varying float v_placement_zoom;
varying float v_perspective_zoom_adjust;
varying vec2 v_fade_tex;

void main() {

    float alpha = 0.5;

    // Green = no collisions, label is showing
    gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0) * alpha;

    // Red = collision, label hidden
    if (texture2D(u_fadetexture, v_fade_tex).a < 1.0) {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0) * alpha;
    }

    // Faded black = this collision box is not used at this zoom (for curved labels)
    if (u_zoom >= v_max_zoom + v_perspective_zoom_adjust) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0) * alpha * 0.25;
    }

    // Faded blue = the placement scale for this label is beyond the CollisionTile
    // max scale, so it's impossible for this label to show without collision detection
    // being run again (the label's glyphs haven't even been added to the symbol bucket)
    if (v_placement_zoom >= u_maxzoom) {
        gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0) * alpha * 0.2;
    }
}
