in highp vec2 v_uv;
in mediump float v_intensity;

// TODO:
// - check other shapes compared to circle, e.g. astroid
// - check the possibility to store a per-vertex index, that determines the shape (to have shape variety)
// - for astroid shapes - check the possibility to pass a 2d rotation matrix per-star, so it could give more variety even for one shape

// float shapeAstroid(in vec2 uv)
// {
//     float beginFade = 0.9;

//     float param = pow(abs(v_uv.x), 2.0 / 3.0) + pow(abs(v_uv.y), 2.0 / 3.0);

//     return 1.0 - clamp((param - beginFade) / (1.0 - beginFade), 0.0, 1.0);
// }

float shapeCircle(in vec2 uv)
{
    // Fade start, percentage of radius 
    float beginFade = 0.6;

    // Linear fade to radius
    float lengthFromCenter = length(v_uv);

    return 1.0 - clamp((lengthFromCenter - beginFade) / (1.0 - beginFade), 0.0, 1.0);
}

void main() {
    float alpha = shapeCircle(v_uv);
    vec3 color = vec3(1.0, 1.0, 1.0);
    alpha *= v_intensity;
    glFragColor = vec4(color * alpha, alpha);

    HANDLE_WIREFRAME_DEBUG;
}
