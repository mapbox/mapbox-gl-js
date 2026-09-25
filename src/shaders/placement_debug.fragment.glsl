uniform vec4 u_color;
uniform float u_outline_width;
uniform float u_opacity;
uniform float u_stroke_opacity;
uniform float u_collision_padding_opacity;

in vec2 v_offset;    // Offset in pixels from the shape center to this fragment.
in vec2 v_half_size; // Half width and half height of the shape; both are the radius for a circle.
in float v_is_circle;
in float v_collision_padding;

// Signed distance from the box centered on the origin to offset, negative inside.
float boxDistance(vec2 offset, vec2 halfSize) {
    vec2 toCorner = abs(offset) - halfSize;
    return max(toCorner.x, toCorner.y);
}

// Signed distance from the circle centered on the origin to offset, negative inside.
float circleDistance(vec2 offset, float radius) {
    return length(offset) - radius;
}

// Like smoothstep, but interpolation is linear.
float linearStep(float start, float end, float x) {
    return (clamp(x, start, end) - start) / (end - start);
}

float onePxLongLinearStepAt(float center, float x) {
    const float halfPx = 0.5;
    return linearStep(center - halfPx, center + halfPx, x);
}

void main() {
    float distanceToEdge = mix(boxDistance(v_offset, v_half_size),
                               circleDistance(v_offset, v_half_size.x),
                               v_is_circle);

    float linearStepAtMinusOutlineWidth = onePxLongLinearStepAt(-u_outline_width, distanceToEdge);
    float linearStepAtZero = onePxLongLinearStepAt(0.0, distanceToEdge);
    float linearStepAtCollisionPadding = onePxLongLinearStepAt(v_collision_padding, distanceToEdge);

    float interiorCoverage = 1.0 - linearStepAtMinusOutlineWidth;
    float outlineCoverage = linearStepAtMinusOutlineWidth - linearStepAtZero;
    float collisionPaddingCoverage = linearStepAtZero - linearStepAtCollisionPadding;

    // u_color is premultiplied, so scaling the whole vector by coverage stays premultiplied and
    // pairs with ColorMode::alphaBlended().
    glFragColor = u_color * (u_opacity * interiorCoverage
                           + u_stroke_opacity * outlineCoverage
                           + u_collision_padding_opacity * collisionPaddingCoverage);
}
