uniform vec4 u_color;
uniform float u_outline_width;
uniform float u_opacity;
uniform float u_stroke_opacity;

in vec2 v_offset;    // Offset in pixels from the shape center to this fragment.
in vec2 v_half_size; // Half width and half height of the shape; both are the radius for a circle.
in float v_is_circle;

// Signed distance from the box centered on the origin to `offset`, negative inside.
float boxDistance(vec2 offset, vec2 halfSize) {
    vec2 toCorner = abs(offset) - halfSize;
    return min(max(toCorner.x, toCorner.y), 0.0) + length(max(toCorner, vec2(0.0)));
}

// Signed distance from the circle centered on the origin to `offset`, negative inside.
float circleDistance(vec2 offset, float radius) {
    return length(offset) - radius;
}

void main() {
    float distanceToEdge = mix(boxDistance(v_offset, v_half_size),
                                     circleDistance(v_offset, v_half_size.x),
                                     v_is_circle);

    // A shape covers its collision bounds exactly: every fragment up to and including the edge, and
    // none beyond it. The outer edge is therefore hard.
    float shapeMask = step(distanceToEdge, 0.0);

    // The outline shows on its inner side only.
    float outlineCoverage = shapeMask * step(-u_outline_width, distanceToEdge);
    float interiorCoverage = step(distanceToEdge, -u_outline_width);

    // u_color is premultiplied, so scaling the whole vector by coverage stays premultiplied and
    // pairs with ColorMode::alphaBlended().
    glFragColor = u_color * (u_stroke_opacity * outlineCoverage + u_opacity * interiorCoverage);
}
