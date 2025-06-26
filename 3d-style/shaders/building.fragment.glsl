#include "_prelude_fog.fragment.glsl"
#include "_prelude_shadow.fragment.glsl"
#include "_prelude_lighting.glsl"

const float window_depth = 0.13;

in vec4 v_color;
in highp vec3 v_normal;
in highp vec3 v_pos;

#ifdef BUILDING_FAUX_FACADE
in lowp float v_faux_facade;
in highp float v_faux_facade_ed;
in highp vec2 v_faux_facade_window;
in highp vec2 v_faux_facade_floor;
in highp vec2 v_faux_facade_range;
in highp float v_aspect;
in highp vec3 v_tbn_0;
in highp vec3 v_tbn_1;
in highp vec3 v_tbn_2;
in highp vec4 v_faux_color_emissive;
uniform float u_faux_facade_ao_intensity;
#endif

#ifdef RENDER_SHADOWS
in highp vec4 v_pos_light_view_0;
in highp vec4 v_pos_light_view_1;
in float v_depth_shadows;
#endif

uniform lowp float u_opacity;
uniform vec3 u_camera_pos; // in tile coordinates
uniform highp float u_tile_to_meter;

uniform float u_facade_emissive_chance;

vec3 linearTosRGB(in vec3 color) {
    return pow(color, vec3(1./2.2));
}

#ifdef BUILDING_FAUX_FACADE
// From https://www.shadertoy.com/view/4djSRW by David Hoskins.
// A shader Hash function that is the same on all systems and doesn't rely on trig functions.
float hash12(in vec2 p) {
	vec3 p3  = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float min3(in vec3 v) {
    return min(min(v.x, v.y), v.z);
}

// q is in meters.
vec2 get_uv_mask_id(in vec2 q, out float mask, out vec2 id) {
    vec2 p = q;
    // Only shade with facades if in range.
    mask = step(v_faux_facade_range.x, p.y) * step(p.y, v_faux_facade_range.y);
    // Compute UVs for windows.
    p.y = p.y - v_faux_facade_range.x;
    vec2 uv = modf(p / v_faux_facade_floor, id);

    vec4 d = (v_faux_facade_floor.xyxy + vec4(-v_faux_facade_window, v_faux_facade_window)) * 0.5;
    vec4 edge = d / v_faux_facade_floor.xyxy;

    vec2 m = step(edge.xy, uv) * step(uv, edge.zw);
    mask *= m.x * m.y;
    uv -= vec2(0.5);
    uv *= vec2(0.5) / (vec2(0.5) - edge.xy);
    uv += vec2(0.5);
    return uv;
}

float ray_unit_box(in vec3 ray_o, in vec3 ray_d, in vec3 bmin, in vec3 bmax) {
    vec3 planes = mix(bmin, bmax, step(0.0, ray_d));
    vec3 t = (planes - ray_o) / ray_d;
    return min3(t);
}

float get_emissive(in vec2 id) {
    if (u_facade_emissive_chance > 0.0) {
        return (step(hash12(id), u_facade_emissive_chance) + 0.05) * v_faux_color_emissive.a;
    }
    return 0.0;
}

// v is in [-0.5, 0.5]^3 space.
vec3 get_shade_info(in vec3 v,
                    in vec3 color,
                    in vec2 id,
                    in mat3 tbn,
                    inout vec3 out_normal,
                    inout float out_emissive) {
    vec3 out_color = color;
    vec3 abs_v = abs(v);
    bool x_major = abs_v.x >= abs_v.y && abs_v.x >= abs_v.z;
    bool y_major = abs_v.y >= abs_v.x && abs_v.y >= abs_v.z;
    bool z_major = abs_v.z >= abs_v.x && abs_v.z >= abs_v.y;
#if 0 // For debugging only.
    if (x_major) {
        out_color = v.x > 0.0 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 1.0);
    } else if (y_major) {
        out_color = v.y > 0.0 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 1.0);
    } else if (z_major) {
        out_color = v.z > 0.0 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 1.0, 0.0);
    }
    out_emissive = 1.0;
#else
    if (x_major) {
        out_normal = sign(v.x) * tbn[0];
    } else if (y_major) {
        out_normal = sign(v.y) * tbn[1];
    } else if (z_major) {
        out_color = v_faux_color_emissive.rgb;
        out_emissive = v.z <= 0.0 ? get_emissive(id) : out_emissive;
    }

    float ao = 1.0;
    if (u_faux_facade_ao_intensity > 0.0) {
        const float ao_radius = 0.04; // todo: could make this configurable in future.
        const float ao_radius_z = 0.01;
        vec2 ao_range_x = vec2(0.5, 0.5 - ao_radius / v_aspect);
        const vec2 ao_range_y = vec2(0.5, 0.5 - ao_radius);
        const vec2 ao_range_z = vec2(0.5, 0.5 - ao_radius_z);
        if (x_major) {
            ao *= smoothstep(-ao_range_y.x, -ao_range_y.y, v.y) * (1.0 - smoothstep(ao_range_y.y, ao_range_y.x, v.y));
            ao *= smoothstep(-ao_range_z.x, -ao_range_z.y, v.z);
        } else if (y_major) {
            ao *= smoothstep(-ao_range_x.x, -ao_range_x.y, v.x) * (1.0 - smoothstep(ao_range_x.y, ao_range_x.x, v.x));
            ao *= smoothstep(-ao_range_z.x, -ao_range_z.y, v.z);
        } else if (z_major) {
            ao *= smoothstep(-ao_range_x.x, -ao_range_x.y, v.x) * (1.0 - smoothstep(ao_range_x.y, ao_range_x.x, v.x));
            ao *= smoothstep(-ao_range_y.x, -ao_range_y.y, v.y) * (1.0 - smoothstep(ao_range_y.y, ao_range_y.x, v.y));
        }
        ao = mix(1.0, ao, u_faux_facade_ao_intensity);
    }

    out_color *= ao;
#endif
    return out_color;
}
#endif // BUILDING_FAUX_FACADE


vec3 apply_lighting_linear(in vec3 color, in vec3 normal, in float dir_factor) {
    float ambient_directional_factor = calculate_ambient_directional_factor(normal);
    vec3 ambient_contrib = ambient_directional_factor * u_lighting_ambient_color;
    vec3 directional_contrib = u_lighting_directional_color * dir_factor;
    return color * (ambient_contrib + directional_contrib);
}

void main() {
    vec3 normal = normalize(v_normal);
    vec3 base_color = v_color.rgb;
    float emissive = v_color.a;

#ifdef BUILDING_FAUX_FACADE
    if (v_faux_facade > 0.0) {
        mat3 tbn = mat3(v_tbn_0, v_tbn_1, v_tbn_2);

        // v_pos.z is in meters.
        vec3 v = vec3(v_pos.xy, v_pos.z / u_tile_to_meter) - u_camera_pos;
        vec3 view_tangent = transpose(tbn) * v; // TBN guaranteed to be orthonormal, so we can use transpose.

        vec2 q = vec2(v_faux_facade_ed, v_pos.z);
        float mask = 0.0;
        vec2 id = vec2(0.0);
        vec2 uv = get_uv_mask_id(q, mask, id);

        // Perform ray intersection with a box defined by bmin and bmax.
        vec3 bmin = vec3(0.0, 0.0, -1.0);
        vec3 bmax = bmin + vec3(v_aspect, 1.0, 1.0);
        vec3 ray_o = vec3(uv * vec2(v_aspect, 1.0), window_depth * min(v_aspect, 1.0 / v_aspect) - 1.0);
        vec3 ray_d = normalize(view_tangent);
        float t_min = ray_unit_box(ray_o, ray_d, bmin, bmax);
        vec3 hit = ray_o + t_min * ray_d;

        // Normalize the hit position taking into account the aspect ratio.
        vec3 bmid = vec3(0.5 * v_aspect, 0.5, -0.5);
        hit = hit - bmid;
        hit.x /= v_aspect;

        vec3 out_normal = normal;
        float out_emissive = emissive;
        vec3 room_color = get_shade_info(hit, base_color, id, tbn, out_normal, out_emissive);

        base_color = mix(base_color, room_color, mask);
        normal = mix(normal, out_normal, mask);
        emissive = mix(emissive, out_emissive, mask);
    }
#endif // BUILDING_FAUX_FACADE

    vec4 color = vec4(base_color, 1.0);
    vec3 xy_flipped_normal = vec3(-normal.xy, normal.z);

    float shadowed_lighting_factor = 0.0;
#ifdef RENDER_SHADOWS
    shadowed_lighting_factor = shadowed_light_factor_normal(xy_flipped_normal, v_pos_light_view_0, v_pos_light_view_1, v_depth_shadows);
#else
    shadowed_lighting_factor = dot(normal, u_lighting_directional_dir);
#endif

    color.rgb = apply_lighting_linear(color.rgb, xy_flipped_normal, shadowed_lighting_factor);
    color.rgb = mix(color.rgb, base_color.rgb, emissive);
    
#ifdef FOG
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos, v_pos.z));
#endif

    color.rgb = linearTosRGB(color.rgb);
    color *= u_opacity;

#ifdef RENDER_CUTOFF
    color *= v_cutoff_opacity;
#endif

#ifdef INDICATOR_CUTOUT
    color = applyCutout(color, v_pos.z);
#endif

    glFragColor = color; 

#ifdef DEBUG_SHOW_NORMALS
    color.rgb = xy_flipped_normal * 0.5 + vec3(0.5, 0.5, 0.5);
    color.a = 1.0;
    glFragColor = color;
#endif

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
