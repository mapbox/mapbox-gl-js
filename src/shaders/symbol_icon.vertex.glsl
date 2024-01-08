#include "_prelude_terrain.vertex.glsl"

in vec4 a_pos_offset;
in vec4 a_tex_size;
in vec4 a_pixeloffset;
in vec4 a_projected_pos;
in float a_fade_opacity;
#ifdef Z_OFFSET
in float a_z_offset;
#endif
#ifdef PROJECTION_GLOBE_VIEW
in vec3 a_globe_anchor;
in vec3 a_globe_normal;
#endif
#ifdef ICON_TRANSITION
in vec2 a_texb;
#endif

uniform bool u_is_size_zoom_constant;
uniform bool u_is_size_feature_constant;
uniform highp float u_size_t; // used to interpolate between zoom stops when size is a composite function
uniform highp float u_size; // used when size is both zoom and feature constant
uniform highp float u_camera_to_center_distance;
uniform bool u_rotate_symbol;
uniform highp float u_aspect_ratio;
uniform float u_fade_change;

uniform mat4 u_matrix;
uniform mat4 u_label_plane_matrix;
uniform mat4 u_coord_matrix;

uniform bool u_is_text;
uniform bool u_pitch_with_map;

uniform vec2 u_texsize;
uniform vec3 u_up_vector;

#ifdef PROJECTION_GLOBE_VIEW
uniform vec3 u_tile_id;
uniform mat4 u_inv_rot_matrix;
uniform vec2 u_merc_center;
uniform vec3 u_camera_forward;
uniform float u_zoom_transition;
uniform vec3 u_ecef_origin;
uniform mat4 u_tile_matrix;
#endif

out vec2 v_tex_a;
#ifdef ICON_TRANSITION
out vec2 v_tex_b;
#endif
out float v_fade_opacity;

#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float emissive_strength

void main() {
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float emissive_strength

    vec2 a_pos = a_pos_offset.xy;
    vec2 a_offset = a_pos_offset.zw;

    vec2 a_tex = a_tex_size.xy;
    vec2 a_size = a_tex_size.zw;

    float a_size_min = floor(a_size[0] * 0.5);
    vec2 a_pxoffset = a_pixeloffset.xy;
    vec2 a_min_font_scale = a_pixeloffset.zw / 256.0;

    highp float segment_angle = -a_projected_pos[3];
    float size;

    if (!u_is_size_zoom_constant && !u_is_size_feature_constant) {
        size = mix(a_size_min, a_size[1], u_size_t) / 128.0;
    } else if (u_is_size_zoom_constant && !u_is_size_feature_constant) {
        size = a_size_min / 128.0;
    } else {
        size = u_size;
    }

    vec2 tile_anchor = a_pos;
    float e = elevation(tile_anchor);
#ifdef Z_OFFSET
    e += a_z_offset;
#endif
    vec3 h = elevationVector(tile_anchor) * e;

    float globe_occlusion_fade;
    vec3 world_pos;
    vec3 mercator_pos;
#ifdef PROJECTION_GLOBE_VIEW
    mercator_pos = mercator_tile_position(u_inv_rot_matrix, tile_anchor, u_tile_id, u_merc_center);
    world_pos = mix_globe_mercator(a_globe_anchor + h, mercator_pos, u_zoom_transition);

    vec4 ecef_point = u_tile_matrix * vec4(world_pos, 1.0);
    vec3 origin_to_point = ecef_point.xyz - u_ecef_origin;

    // Occlude symbols that are on the non-visible side of the globe sphere
    globe_occlusion_fade = dot(origin_to_point, u_camera_forward) >= 0.0 ? 0.0 : 1.0;
#else
    world_pos = vec3(tile_anchor, 0) + h;
    globe_occlusion_fade = 1.0;
#endif

    vec4 projected_point = u_matrix * vec4(world_pos, 1);

    highp float camera_to_anchor_distance = projected_point.w;
    // See comments in symbol_sdf.vertex
    highp float distance_ratio = u_pitch_with_map ?
        camera_to_anchor_distance / u_camera_to_center_distance :
        u_camera_to_center_distance / camera_to_anchor_distance;
    highp float perspective_ratio = clamp(
            0.5 + 0.5 * distance_ratio,
            0.0, // Prevents oversized near-field symbols in pitched/overzoomed tiles
            1.5);

    size *= perspective_ratio;

    float font_scale = u_is_text ? size / 24.0 : size;

    highp float symbol_rotation = 0.0;
    if (u_rotate_symbol) {
        // See comments in symbol_sdf.vertex
        vec4 offsetProjected_point;
#ifdef PROJECTION_GLOBE_VIEW
        vec3 displacement = vec3(a_globe_normal.z, 0, -a_globe_normal.x);
        offsetProjected_point = u_matrix * vec4(a_globe_anchor + displacement, 1);
#else
        offsetProjected_point = u_matrix * vec4(tile_anchor + vec2(1, 0), 0, 1);
#endif
        vec2 a = projected_point.xy / projected_point.w;
        vec2 b = offsetProjected_point.xy / offsetProjected_point.w;

        symbol_rotation = atan((b.y - a.y) / u_aspect_ratio, b.x - a.x);
    }

    vec4 projected_pos;
#ifdef PROJECTION_GLOBE_VIEW
    vec3 proj_pos = mix_globe_mercator(a_projected_pos.xyz + h, mercator_pos, u_zoom_transition);
    projected_pos = u_label_plane_matrix * vec4(proj_pos, 1.0);
#else
    projected_pos = u_label_plane_matrix * vec4(a_projected_pos.xy, h.z, 1.0);
#endif

    highp float angle_sin = sin(segment_angle + symbol_rotation);
    highp float angle_cos = cos(segment_angle + symbol_rotation);
    mat2 rotation_matrix = mat2(angle_cos, -1.0 * angle_sin, angle_sin, angle_cos);

    float z = 0.0;
    vec2 offset = rotation_matrix * (a_offset / 32.0 * max(a_min_font_scale, font_scale) + a_pxoffset / 16.0);
#ifdef TERRAIN
#ifdef PITCH_WITH_MAP_TERRAIN
    vec4 tile_pos = u_label_plane_matrix_inv * vec4(a_projected_pos.xy + offset, 0.0, 1.0);
    z = elevation(tile_pos.xy);
#endif
#endif
    // Symbols might end up being behind the camera. Move them AWAY.
    float occlusion_fade = occlusionFade(projected_point) * globe_occlusion_fade;
    float projection_transition_fade = 1.0;
#if defined(PROJECTED_POS_ON_VIEWPORT) && defined(PROJECTION_GLOBE_VIEW)
    projection_transition_fade = 1.0 - step(EPSILON, u_zoom_transition);
#endif
    vec2 fade_opacity = unpack_opacity(a_fade_opacity);
    float fade_change = fade_opacity[1] > 0.5 ? u_fade_change : -u_fade_change;
    float out_fade_opacity = max(0.0, min(occlusion_fade, fade_opacity[0] + fade_change)) * projection_transition_fade;
    float alpha = opacity * out_fade_opacity;
    float hidden = float(alpha == 0.0 || projected_point.w <= 0.0 || occlusion_fade == 0.0);

#ifdef PROJECTION_GLOBE_VIEW
    // Map aligned labels in globe view are aligned to the surface of the globe
    vec3 xAxis = u_pitch_with_map ? normalize(cross(a_globe_normal, u_up_vector)) : vec3(1, 0, 0);
    vec3 yAxis = u_pitch_with_map ? normalize(cross(a_globe_normal, xAxis)) : vec3(0, 1, 0);

    gl_Position = mix(u_coord_matrix * vec4(projected_pos.xyz / projected_pos.w + xAxis * offset.x + yAxis * offset.y, 1.0), AWAY, hidden);
#else
    gl_Position = mix(u_coord_matrix * vec4(projected_pos.xy / projected_pos.w + offset, z, 1.0), AWAY, hidden);
#endif

    v_tex_a = a_tex / u_texsize;
#ifdef ICON_TRANSITION
    v_tex_b = a_texb / u_texsize;
#endif
    v_fade_opacity = out_fade_opacity;
}
