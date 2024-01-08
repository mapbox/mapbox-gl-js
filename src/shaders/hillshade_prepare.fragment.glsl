precision highp float;

uniform sampler2D u_image;
in vec2 v_pos;
uniform vec2 u_dimension;
uniform float u_zoom;

float getElevation(vec2 coord) {
    return texture(u_image, coord).r / 4.0;
}

void main() {
    vec2 epsilon = 1.0 / u_dimension;

    // queried pixels:
    // +-----------+
    // |   |   |   |
    // | a | b | c |
    // |   |   |   |
    // +-----------+
    // |   |   |   |
    // | d |   | e |
    // |   |   |   |
    // +-----------+
    // |   |   |   |
    // | f | g | h |
    // |   |   |   |
    // +-----------+

    float a = getElevation(v_pos + vec2(-epsilon.x, -epsilon.y));
    float b = getElevation(v_pos + vec2(0, -epsilon.y));
    float c = getElevation(v_pos + vec2(epsilon.x, -epsilon.y));
    float d = getElevation(v_pos + vec2(-epsilon.x, 0));
    float e = getElevation(v_pos + vec2(epsilon.x, 0));
    float f = getElevation(v_pos + vec2(-epsilon.x, epsilon.y));
    float g = getElevation(v_pos + vec2(0, epsilon.y));
    float h = getElevation(v_pos + vec2(epsilon.x, epsilon.y));

    // Here we divide the x and y slopes by 8 * pixel size
    // where pixel size (aka meters/pixel) is:
    // circumference of the world / (pixels per tile * number of tiles)
    // which is equivalent to: 8 * 40075016.6855785 / (512 * pow(2, u_zoom))
    // which can be reduced to: pow(2, 19.25619978527 - u_zoom).
    // We want to vertically exaggerate the hillshading because otherwise
    // it is barely noticeable at low zooms. To do this, we multiply this by
    // a scale factor that is a function of zooms below 15, which is an arbitrary
    // that corresponds to the max zoom level of Mapbox terrain-RGB tiles.
    // See nickidlugash's awesome breakdown for more info:
    // https://github.com/mapbox/mapbox-gl-js/pull/5286#discussion_r148419556

    float exaggerationFactor = u_zoom < 2.0 ? 0.4 : u_zoom < 4.5 ? 0.35 : 0.3;
    float exaggeration = u_zoom < 15.0 ? (u_zoom - 15.0) * exaggerationFactor : 0.0;

    vec2 deriv = vec2(
        (c + e + e + h) - (a + d + d + f),
        (f + g + g + h) - (a + b + b + c)
    ) / pow(2.0, exaggeration + (19.2562 - u_zoom));

    glFragColor = clamp(vec4(
        deriv.x / 2.0 + 0.5,
        deriv.y / 2.0 + 0.5,
        1.0,
        1.0), 0.0, 1.0);
}
