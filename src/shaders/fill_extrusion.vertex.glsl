uniform mat4 u_matrix;
uniform vec3 u_lightcolor;
uniform lowp vec3 u_lightpos;
uniform lowp float u_lightintensity;

attribute vec2 a_pos;
attribute vec3 a_normal;
attribute float a_edgedistance;

varying vec4 v_color;

#pragma mapbox: define lowp float base
#pragma mapbox: define lowp float height

#pragma mapbox: define highp vec4 color

void main() {
    #pragma mapbox: initialize lowp float base
    #pragma mapbox: initialize lowp float height
    #pragma mapbox: initialize highp vec4 color

    base = max(0.0, base);
    height = max(0.0, height);

    float ed = a_edgedistance; // use each attrib in order to not trip a VAO assert
    float t = mod(a_normal.x, 2.0);

    gl_Position = u_matrix * vec4(a_pos, t > 0.0 ? height : base, 1);

    // Relative luminance (how dark/bright is the surface color?)
    float colorvalue = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;

    v_color = vec4(0.0, 0.0, 0.0, 1.0);

    // Add slight ambient lighting so no extrusions are totally black
    vec4 ambientlight = vec4(0.03, 0.03, 0.03, 1.0);
    color += ambientlight;

    // Calculate cos(theta), where theta is the angle between surface normal and diffuse light ray
    float directional = clamp(dot(a_normal / 16384.0, u_lightpos), 0.0, 1.0);

    // Adjust directional so that
    // the range of values for highlight/shading is narrower
    // with lower light intensity
    // and with lighter/brighter surface colors
    directional = mix((1.0 - u_lightintensity), max((1.0 - colorvalue + u_lightintensity), 1.0), directional);

    // Add gradient along z axis of side surfaces
    if (a_normal.y != 0.0) {
        directional *= clamp((t + base) * pow(height / 150.0, 0.5), mix(0.7, 0.98, 1.0 - u_lightintensity), 1.0);
    }

    // Assign final color based on surface + ambient light color, diffuse light directional, and light color
    // with lower bounds adjusted to hue of light
    // so that shading is tinted with the complementary (opposite) color to the light color
    v_color.r += clamp(color.r * directional * u_lightcolor.r, mix(0.0, 0.3, 1.0 - u_lightcolor.r), 1.0);
    v_color.g += clamp(color.g * directional * u_lightcolor.g, mix(0.0, 0.3, 1.0 - u_lightcolor.g), 1.0);
    v_color.b += clamp(color.b * directional * u_lightcolor.b, mix(0.0, 0.3, 1.0 - u_lightcolor.b), 1.0);
}
