uniform mat4 u_matrix;
uniform vec2 u_pixel_coord_upper;
uniform vec2 u_pixel_coord_lower;
uniform float u_height_factor;
uniform vec3 u_scale;
uniform float u_vertical_gradient;
uniform lowp float u_opacity;

uniform vec3 u_lightcolor;
uniform lowp vec3 u_lightpos;
uniform lowp float u_lightintensity;

attribute vec4 a_pos_normal_ed;
attribute vec2 a_centroid_pos;

varying vec2 v_pos_a;
varying vec2 v_pos_b;
varying vec4 v_lighting;

#pragma mapbox: define lowp float base
#pragma mapbox: define lowp float height
#pragma mapbox: define lowp vec4 pattern_from
#pragma mapbox: define lowp vec4 pattern_to
#pragma mapbox: define lowp float pixel_ratio_from
#pragma mapbox: define lowp float pixel_ratio_to

void main() {
    #pragma mapbox: initialize lowp float base
    #pragma mapbox: initialize lowp float height
    #pragma mapbox: initialize mediump vec4 pattern_from
    #pragma mapbox: initialize mediump vec4 pattern_to
    #pragma mapbox: initialize lowp float pixel_ratio_from
    #pragma mapbox: initialize lowp float pixel_ratio_to

    vec2 pattern_tl_a = pattern_from.xy;
    vec2 pattern_br_a = pattern_from.zw;
    vec2 pattern_tl_b = pattern_to.xy;
    vec2 pattern_br_b = pattern_to.zw;

    float tileRatio = u_scale.x;
    float fromScale = u_scale.y;
    float toScale = u_scale.z;

    vec3 pos_nx = floor(a_pos_normal_ed.xyz * 0.5);
    // The least significant bits of a_pos_normal_ed.xy hold:
    // x is 1 if it's on top, 0 for ground.
    // y is 1 if the normal points up, and 0 if it points to side.
    // z is sign of ny: 1 for positive, 0 for values <= 0.
    mediump vec3 top_up_ny = a_pos_normal_ed.xyz - 2.0 * pos_nx;

    float x_normal = pos_nx.z / 8192.0;
    vec3 normal = top_up_ny.y == 1.0 ? vec3(0.0, 0.0, 1.0) : normalize(vec3(x_normal, (2.0 * top_up_ny.z - 1.0) * (1.0 - abs(x_normal)), 0.0));
    float edgedistance = a_pos_normal_ed.w;

    vec2 display_size_a = (pattern_br_a - pattern_tl_a) / pixel_ratio_from;
    vec2 display_size_b = (pattern_br_b - pattern_tl_b) / pixel_ratio_to;

    base = max(0.0, base);
    height = max(0.0, height);

    float t = top_up_ny.x;
    float z = t > 0.0 ? height : base;

    vec2 centroid_pos = vec2(0.0);
#if defined(HAS_CENTROID) || defined(TERRAIN)
    centroid_pos = a_centroid_pos;
#endif

#ifdef TERRAIN
    bool flat_roof = centroid_pos.x != 0.0 && t > 0.0;
    float ele = elevation(pos_nx.xy);
    float c_ele = flat_roof ? centroid_pos.y == 0.0 ? elevationFromUint16(centroid_pos.x) : flatElevation(centroid_pos) : ele;
    // If centroid elevation lower than vertex elevation, roof at least 2 meters height above base.
    float h = flat_roof ? max(c_ele + height, ele + base + 2.0) : ele + (t > 0.0 ? height : base == 0.0 ? -5.0 : base);
    vec3 p = vec3(pos_nx.xy, h);
#else
    vec3 p = vec3(pos_nx.xy, z);
#endif

    float hidden = float(centroid_pos.x == 0.0 && centroid_pos.y == 1.0);
    gl_Position = mix(u_matrix * vec4(p, 1), AWAY, hidden);

    vec2 pos = normal.z == 1.0
        ? pos_nx.xy // extrusion top
        : vec2(edgedistance, z * u_height_factor); // extrusion side

    v_pos_a = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, fromScale * display_size_a, tileRatio, pos);
    v_pos_b = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, toScale * display_size_b, tileRatio, pos);

    v_lighting = vec4(0.0, 0.0, 0.0, 1.0);
    float directional = clamp(dot(normal, u_lightpos), 0.0, 1.0);
    directional = mix((1.0 - u_lightintensity), max((0.5 + u_lightintensity), 1.0), directional);

    if (normal.y != 0.0) {
        // This avoids another branching statement, but multiplies by a constant of 0.84 if no vertical gradient,
        // and otherwise calculates the gradient based on base + height
        directional *= (
            (1.0 - u_vertical_gradient) +
            (u_vertical_gradient * clamp((t + base) * pow(height / 150.0, 0.5), mix(0.7, 0.98, 1.0 - u_lightintensity), 1.0)));
    }

    v_lighting.rgb += clamp(directional * u_lightcolor, mix(vec3(0.0), vec3(0.3), 1.0 - u_lightcolor), vec3(1.0));
    v_lighting *= u_opacity;

#ifdef FOG
    v_fog_pos = fog_position(p);
#endif
}
