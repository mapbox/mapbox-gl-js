uniform mat4 u_matrix;
uniform mat4 u_specular_light_matrix;
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;
uniform mat4 u_light_matrix_2;
uniform vec3 u_lightcolor;
uniform lowp vec3 u_lightpos;
uniform lowp float u_lightintensity;
uniform float u_vertical_gradient;
uniform lowp float u_opacity;

attribute vec4 a_pos_normal_ed;
attribute vec2 a_centroid_pos;

#ifdef PROJECTION_GLOBE_VIEW
attribute vec3 a_pos_3;         // Projected position on the globe
attribute vec3 a_pos_normal_3;  // Surface normal at the position

uniform mat4 u_inv_rot_matrix;
uniform vec2 u_merc_center;
uniform vec3 u_tile_id;
uniform float u_zoom_transition;
uniform vec3 u_up_dir;
uniform float u_height_lift;
#endif

varying vec4 v_pos_light_view_0;
varying vec4 v_pos_light_view_1;
varying vec4 v_pos_light_view_2;
varying float v_depth;
varying vec3 v_normal;
varying vec3 v_position;
varying float v_base;
varying float v_height;
varying float v_t;

// varying vec4 v_color;
varying vec3 v_gradient;

#pragma mapbox: define highp float base
#pragma mapbox: define highp float height
#pragma mapbox: define highp vec4 color


void main() {
    #pragma mapbox: initialize highp float base
    #pragma mapbox: initialize highp float height
    #pragma mapbox: initialize highp vec4 color


    vec3 pos_nx = floor(a_pos_normal_ed.xyz * 0.5);
    // The least significant bits of a_pos_normal_ed.xy hold:
    // x is 1 if it's on top, 0 for ground.
    // y is 1 if the normal points up, and 0 if it points to side.
    // z is sign of ny: 1 for positive, 0 for values <= 0.
    mediump vec3 top_up_ny = a_pos_normal_ed.xyz - 2.0 * pos_nx;
    bool concave = a_pos_normal_ed.w < 0.0;

    float x_normal = pos_nx.z / 8192.0;
    vec3 normal = top_up_ny.y == 1.0 ? vec3(0.0, 0.0, 1.0) : normalize(vec3(x_normal, (2.0 * top_up_ny.z - 1.0) * (1.0 - abs(x_normal)), 0.0));

    v_base = max(0.0, base);
    v_height = max(0.0, height);

    float t = top_up_ny.x;

    vec2 centroid_pos = vec2(0.0);
#if defined(HAS_CENTROID) || defined(TERRAIN)
    centroid_pos = a_centroid_pos;
#endif

// For round roof, ny is up and edge distance is used for vertical offset
float dh = top_up_ny.y * a_pos_normal_ed.w * 0.1;

#ifdef TERRAIN
    bool flat_roof = centroid_pos.x != 0.0 && t > 0.0;
    float ele = elevation(pos_nx.xy);
    float c_ele = flat_roof ? centroid_pos.y == 0.0 ? elevationFromUint16(centroid_pos.x) : flatElevation(centroid_pos) : ele;
    // If centroid elevation lower than vertex elevation, roof at least 2 meters height above base.
    float h = flat_roof ? max(c_ele + v_height + dh, ele + v_base + 2.0) : ele + (t > 0.0 ? v_height = dh : v_base == 0.0 ? -5.0 : v_base);
    vec3 pos = vec3(pos_nx.xy, h);
#else
    vec3 pos = vec3(pos_nx.xy, t > 0.0 ? v_height + dh : v_base);
#endif

#ifdef PROJECTION_GLOBE_VIEW
    // If t > 0 (top) we always add the lift, otherwise (ground) we only add it if base height is > 0
    float lift = float((t + v_base) > 0.0) * u_height_lift;
    vec3 globe_normal = normalize(mix(a_pos_normal_3 / 16384.0, u_up_dir, u_zoom_transition));
    vec3 globe_pos = a_pos_3 + globe_normal * (u_tile_up_scale * (pos.z + lift));
    vec3 merc_pos = mercator_tile_position(u_inv_rot_matrix, pos.xy, u_tile_id, u_merc_center) + u_up_dir * u_tile_up_scale * pos.z;
    pos = mix_globe_mercator(globe_pos, merc_pos, u_zoom_transition);
#endif

    float hidden = float(centroid_pos.x == 0.0 && centroid_pos.y == 1.0);
    vec4 outPos = mix(u_matrix * vec4(pos, 1), AWAY, hidden);
    // Z - fighting with vertical gradient
    outPos.z -= height * 0.00015;
    gl_Position = outPos;

    v_gradient = vec3(concave ? mix(0.9, 0.98, t) : 1.0, 1.0, t > 0.0 ? v_height + dh : v_base);
    if (top_up_ny.y != 1.0) {
        v_gradient.y = (1.0 - u_vertical_gradient) + (u_vertical_gradient * clamp(t + base, mix(0.8, 1.0, 1.0 - u_lightintensity), 1.0));
    }

    v_position = vec3(u_specular_light_matrix * vec4(pos, 1));
    v_position.xy = -v_position.xy;
    v_pos_light_view_0 = u_light_matrix_0 * vec4(pos_nx.xy, t > 0.0 ? v_height : v_base, 1);
    v_pos_light_view_1 = u_light_matrix_1 * vec4(pos_nx.xy, t > 0.0 ? v_height : v_base, 1);
    v_pos_light_view_2 = u_light_matrix_2 * vec4(pos_nx.xy, t > 0.0 ? v_height : v_base, 1);
    v_normal = normal;
    v_t = t;
    v_depth = gl_Position.w;
#ifdef FOG
    v_fog_pos = fog_position(pos);
#endif
}
