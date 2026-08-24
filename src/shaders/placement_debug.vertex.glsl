// Draws one collision shape -- an axis-aligned box or a circle -- as a quad. All four vertices of a
// shape carry the same center, half size and kind; only the corner index in a_flags.y differs.

in vec2 a_pos_2f; // Shape center, in physical pixels, y down from the viewport's top-left corner.
in vec2 a_size;   // Half width and half height of the shape; both are the radius for a circle.
in ivec2 a_flags; // x: 1 for a circle, 0 for a box. y: which corner of the quad this vertex is, 0..3.

uniform vec2 u_viewport_size;

// The fragment stage rebuilds the shape from these as a signed distance field.
out vec2 v_offset;
out vec2 v_half_size;
out float v_is_circle;

// Indexed by a_flags.y.
const vec2 QUAD_CORNERS[4] = vec2[4](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0));

void main() {
    vec2 offset = QUAD_CORNERS[a_flags.y] * a_size;

    v_offset = offset;
    v_half_size = a_size;
    v_is_circle = float(a_flags.x);

    // Placement works in a y-down, top-left-origin screen space; NDC is y-up and centered.
    vec2 viewportPos = (a_pos_2f + offset) / u_viewport_size;
    gl_Position = vec4(viewportPos * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
}
