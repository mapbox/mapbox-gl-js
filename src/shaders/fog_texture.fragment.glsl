uniform sampler2D u_image;
varying vec2 v_pos;


// Unpack depth from RGBA. A piece of code copied in various libraries and WebGL
// shadow mapping examples.
float unpack_depth(vec4 rgba_depth)
{
    const vec4 bit_shift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(rgba_depth, bit_shift) * 2.0 - 1.0;
}

void main() {
    float fog_depth = unpack_depth(texture2D(u_image, v_pos));

    gl_FragColor = vec4(u_fog_color * fog_depth, fog_depth);
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(0.0);
#endif
}
