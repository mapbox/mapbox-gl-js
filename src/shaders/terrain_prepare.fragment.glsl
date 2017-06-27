#ifdef GL_ES
precision mediump float;
#else
#define lowp
#define mediump
#define highp
#endif

uniform sampler2D u_image;
varying vec2 v_pos;
uniform vec2 u_dimension;
uniform float u_zoom;

float getElevation(vec2 coord, float bias) {
    // Convert encoded elevation value to meters
    vec4 data = texture2D(u_image, coord, bias) * 255.0;
    // return data.r * 256.0 + data.g + data.b / 256.0 - 32768.0;
    // return ((data.r * 256.0 * 256.0 + data.g * 256.0 + data.b) / 10.0 - 10000.0) * 2.0;
    return (data.r + data.g * 256.0 + data.b * 256.0 * 256.0) / 4.0;
}

void main() {
    vec2 epsilon = 1.0 / u_dimension;
    float a = getElevation(v_pos + vec2(-epsilon.x, -epsilon.y), 0.0);
    float b = getElevation(v_pos + vec2(0, -epsilon.y), 0.0);
    float c = getElevation(v_pos + vec2(epsilon.x, -epsilon.y), 0.0);
    float d = getElevation(v_pos + vec2(-epsilon.x, 0), 0.0);
    float e = getElevation(v_pos, 0.0);
    float f = getElevation(v_pos + vec2(epsilon.x, 0), 0.0);
    float g = getElevation(v_pos + vec2(-epsilon.x, epsilon.y), 0.0);
    float h = getElevation(v_pos + vec2(0, epsilon.y), 0.0);
    float i = getElevation(v_pos + vec2(epsilon.x, epsilon.y), 0.0);

    vec2 deriv = vec2(
        (c + f + f + i) - (a + d + d + g),
        (g + h + h + i) - (a + b + b + c)
        // decrease the value u_zoom is subtracted from to intensify terrain appearance
    ) / pow(2.0, 19.0 - u_zoom);


    gl_FragColor = clamp(vec4(
        deriv.x / 2.0 + 0.5,
        deriv.y / 2.0 + 0.5,
        1.0,
        1.0), 0.0, 1.0);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
