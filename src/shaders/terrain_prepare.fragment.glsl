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

float getOpenness(vec2 dir, float ref, float metersPerPixel) {
    float result = -32768.0;

    float sum = 0.0;

    const int dim = 6;
    for (int level = 0; level <= dim; level++) {
        float factor = pow(2.0, float(level - 1));
        vec2 coord = v_pos + (factor * dir) / (u_dimension);
        float delta = max(0.0, getElevation(coord, float(level)) - ref);
        result = max(result, delta / factor);
    }

    return atan(2.0, result / metersPerPixel) * 200.0 - 100.0;
}

#define PI 3.141592653589793

void main() {
    vec2 epsilon = 0.25 / u_dimension;
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
    ) / pow(2.0, 20.0 - u_zoom);

    float metersPerPixel = (11752832.0 / pow(2.0, u_zoom) / 256.0) * 1.0;
    float openness = 0.0;
    int count = 0;
    float ref = getElevation(v_pos, 0.0);
    for (int deg = -180; deg < 180; deg += 45) {
        float rad = radians(float(deg));
        openness += getOpenness(vec2(cos(rad), sin(rad)), ref, metersPerPixel);
        count++;
    }
    openness /= float(count);
    openness /= 255.0;

    gl_FragColor = clamp(vec4(
        deriv.x / 2.0 + 0.5,
        deriv.y / 2.0 + 0.5,
        openness,
        1.0), 0.0, 1.0);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
