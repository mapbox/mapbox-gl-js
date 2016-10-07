#ifdef GL_ES
precision highp float;
#else
#define lowp
#define mediump
#define highp
#endif

uniform mat4 u_matrix;
uniform vec2 u_pattern_size_a;
uniform vec2 u_pattern_size_b;
uniform vec2 u_pixel_coord_upper;
uniform vec2 u_pixel_coord_lower;
uniform float u_scale_a;
uniform float u_scale_b;
uniform float u_tile_units_to_pixels;
uniform float u_height_factor;

uniform vec3 u_lightcolor;
uniform lowp vec3 u_lightpos;
uniform lowp float u_lightintensity;

attribute vec2 a_pos;
attribute vec3 a_normal;
attribute float a_edgedistance;

varying vec2 v_pos_a;
varying vec2 v_pos_b;
varying vec4 v_lighting;
varying float v_directional;

#ifndef MAPBOX_GL_JS
attribute float minH;
attribute float maxH;
#else
#pragma mapbox: define lowp float minH
#pragma mapbox: define lowp float maxH
#endif

#pragma mapbox: define lowp vec4 color

void main() {
#ifdef MAPBOX_GL_JS
    #pragma mapbox: initialize lowp float minH
    #pragma mapbox: initialize lowp float maxH
#endif
    #pragma mapbox: initialize lowp vec4 color

    float t = mod(a_normal.x, 2.0);
    float z = t > 0.0 ? maxH : minH;

    gl_Position = u_matrix * vec4(a_pos, z, 1);

    vec2 scaled_size_a = u_scale_a * u_pattern_size_a;
    vec2 scaled_size_b = u_scale_b * u_pattern_size_b;

    // the following offset calculation is duplicated from the regular pattern shader:
    vec2 offset_a = mod(mod(mod(u_pixel_coord_upper, scaled_size_a) * 256.0, scaled_size_a) * 256.0 + u_pixel_coord_lower, scaled_size_a);
    vec2 offset_b = mod(mod(mod(u_pixel_coord_upper, scaled_size_b) * 256.0, scaled_size_b) * 256.0 + u_pixel_coord_lower, scaled_size_b);

    if (a_normal.x == 1.0 && a_normal.y == 0.0 && a_normal.z == 16384.0) {
        // extrusion top
        v_pos_a = (u_tile_units_to_pixels * a_pos + offset_a) / scaled_size_a;
        v_pos_b = (u_tile_units_to_pixels * a_pos + offset_b) / scaled_size_b;
    } else {
        // extrusion side
        float hf = z * u_height_factor;

        v_pos_a = (u_tile_units_to_pixels * vec2(a_edgedistance, hf) + offset_a) / scaled_size_a;
        v_pos_b = (u_tile_units_to_pixels * vec2(a_edgedistance, hf) + offset_b) / scaled_size_b;
    }

    v_lighting = vec4(0.0, 0.0, 0.0, 1.0);
    float directional = clamp(dot(a_normal / 16383.0, u_lightpos), 0.0, 1.0);
    directional = mix((1.0 - u_lightintensity), max((0.5 + u_lightintensity), 1.0), directional);

    if (a_normal.y != 0.0) {
        directional *= clamp((t + minH) * pow(maxH / 150.0, 0.5), mix(0.7, 0.98, 1.0 - u_lightintensity), 1.0);
    }

    v_lighting.rgb += clamp(directional * u_lightcolor, mix(vec3(0.0), vec3(0.3), 1.0 - u_lightcolor), vec3(1.0));
}
