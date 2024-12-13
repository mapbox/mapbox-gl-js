#include "_prelude_fog.vertex.glsl"
#include "_prelude_terrain.vertex.glsl"
#include "_prelude_shadow.vertex.glsl"
#include "_prelude_lighting.glsl"

uniform mat4 u_matrix;
uniform vec3 u_lightcolor;
uniform lowp vec3 u_lightpos;
uniform lowp float u_lightintensity;
uniform float u_vertical_gradient;
uniform lowp float u_opacity;
uniform float u_edge_radius;
uniform float u_width_scale;

in vec4 a_pos_normal_ed;
in vec2 a_centroid_pos;

#ifdef RENDER_WALL_MODE
in vec3 a_join_normal_inside;
#endif

#ifdef PROJECTION_GLOBE_VIEW
in vec3 a_pos_3;         // Projected position on the globe
in vec3 a_pos_normal_3;  // Surface normal at the position

uniform mat4 u_inv_rot_matrix;
uniform vec2 u_merc_center;
uniform vec3 u_tile_id;
uniform float u_zoom_transition;
uniform vec3 u_up_dir;
uniform float u_height_lift;
#endif

#ifdef TERRAIN
uniform int u_height_type;
uniform int u_base_type;
#endif

uniform highp float u_vertical_scale;

out vec4 v_color;
out vec4 v_flat;

#ifdef RENDER_SHADOWS
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;

out highp vec4 v_pos_light_view_0;
out highp vec4 v_pos_light_view_1;

#endif

#if defined(ZERO_ROOF_RADIUS) && !defined(LIGHTING_3D_MODE)
out vec4 v_roof_color;
#endif

#if defined(ZERO_ROOF_RADIUS) || defined(RENDER_SHADOWS) || defined(LIGHTING_3D_MODE)
out highp vec3 v_normal;
#endif

#ifdef FAUX_AO
uniform lowp vec2 u_ao;
out vec2 v_ao;
#endif

#if defined(LIGHTING_3D_MODE) && defined(FLOOD_LIGHT)
out float v_flood_radius;
out float v_has_floodlight;
#endif

out float v_height;

// linear to sRGB approximation
vec3 linearTosRGB(vec3 color) {
    return pow(color, vec3(1./2.2));
}
vec3 sRGBToLinear(vec3 srgbIn) {
    return pow(srgbIn, vec3(2.2));
}

#pragma mapbox: define highp float base
#pragma mapbox: define highp float height

#pragma mapbox: define highp vec4 color
#pragma mapbox: define highp float flood_light_wall_radius
#pragma mapbox: define highp float line_width
#pragma mapbox: define highp float emissive_strength

void main() {
    #pragma mapbox: initialize highp float base
    #pragma mapbox: initialize highp float height
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize highp float flood_light_wall_radius
    #pragma mapbox: initialize highp float line_width
    #pragma mapbox: initialize highp float emissive_strength
    
    base *= u_vertical_scale;
    height *= u_vertical_scale;
    
    vec4 pos_nx = floor(a_pos_normal_ed * 0.5);
    // The least significant bits of a_pos_normal_ed hold:
    // x is 1 if it's on top, 0 for ground.
    // y is 1 if the normal points up, and 0 if it points to side.
    // z is sign of ny: 1 for positive, 0 for values <= 0.
    // w marks edge's start, 0 is for edge end, edgeDistance increases from start to end.
    vec4 top_up_ny_start = a_pos_normal_ed - 2.0 * pos_nx;
    vec3 top_up_ny = top_up_ny_start.xyz;

    float x_normal = pos_nx.z / 8192.0;
    vec3 normal = top_up_ny.y == 1.0 ? vec3(0.0, 0.0, 1.0) : normalize(vec3(x_normal, (2.0 * top_up_ny.z - 1.0) * (1.0 - abs(x_normal)), 0.0));
#if defined(ZERO_ROOF_RADIUS) || defined(RENDER_SHADOWS) || defined(LIGHTING_3D_MODE)
    v_normal = normal;
#endif

    base = max(0.0, base);

    float attr_height = height;
    height = max(0.0, top_up_ny.y == 0.0 && top_up_ny.x == 1.0 ? height - u_edge_radius : height);

    float t = top_up_ny.x;

    vec2 centroid_pos = vec2(0.0);
#if defined(HAS_CENTROID) || defined(TERRAIN)
    centroid_pos = a_centroid_pos;
#endif

    float ele = 0.0;
    float h = 0.0;
    float c_ele = 0.0;
    vec3 pos;
#ifdef TERRAIN
    bool is_flat_height = centroid_pos.x != 0.0 && u_height_type == 1;
    bool is_flat_base = centroid_pos.x != 0.0 && u_base_type == 1;
    ele = elevation(pos_nx.xy);
    c_ele = is_flat_height || is_flat_base ? (centroid_pos.y == 0.0 ? elevationFromUint16(centroid_pos.x) : flatElevation(centroid_pos)) : ele;
    float h_height = is_flat_height ? max(c_ele + height, ele + base + 2.0) : ele + height;
    float h_base = is_flat_base ? max(c_ele + base, ele + base) : ele + (base == 0.0 ? -5.0 : base);
    h = t > 0.0 ? max(h_base, h_height) : h_base;
    pos = vec3(pos_nx.xy, h);
#else
    h = t > 0.0 ? height : base;
    pos = vec3(pos_nx.xy, h);
#endif

#ifdef PROJECTION_GLOBE_VIEW
    // If t > 0 (top) we always add the lift, otherwise (ground) we only add it if base height is > 0
    float lift = float((t + base) > 0.0) * u_height_lift;
    h += lift;
    vec3 globe_normal = normalize(mix(a_pos_normal_3 / 16384.0, u_up_dir, u_zoom_transition));
    vec3 globe_pos = a_pos_3 + globe_normal * (u_tile_up_scale * h);
    vec3 merc_pos = mercator_tile_position(u_inv_rot_matrix, pos.xy, u_tile_id, u_merc_center) + u_up_dir * u_tile_up_scale * pos.z;
    pos = mix_globe_mercator(globe_pos, merc_pos, u_zoom_transition);
#endif

    float cutoff = 1.0;
    vec3 scaled_pos = pos;
#ifdef RENDER_CUTOFF
    vec3 centroid_random = vec3(centroid_pos.xy, centroid_pos.x + centroid_pos.y + 1.0);
    vec3 ground_pos = centroid_pos.x == 0.0 ? pos.xyz : (centroid_random / 8.0);
    vec4 ground = u_matrix * vec4(ground_pos.xy, ele, 1.0);
    cutoff = cutoff_opacity(u_cutoff_params, ground.z);
    if (centroid_pos.y != 0.0 && centroid_pos.x != 0.0) {
        vec3 g = floor(ground_pos);
        vec3 mod_ = centroid_random - g * 8.0;
        float seed = min(1.0, 0.1 * (min(3.5, max(mod_.x + mod_.y, 0.2 * attr_height)) * 0.35 + mod_.z));
        if (cutoff < 0.8 - seed) {
            cutoff = 0.0;
        }
    }
    float cutoff_scale = cutoff;
    v_cutoff_opacity = cutoff;

    scaled_pos.z = mix(c_ele, h, cutoff_scale);
#endif
    float hidden = float((centroid_pos.x == 0.0 && centroid_pos.y == 1.0) || (cutoff == 0.0 && centroid_pos.x != 0.0) || (color.a == 0.0));

#ifdef RENDER_WALL_MODE
    vec2 wall_offset = u_width_scale * line_width * (a_join_normal_inside.xy / EXTENT);
    scaled_pos.xy += (1.0 - a_join_normal_inside.z) * wall_offset * 0.5;
    scaled_pos.xy -= a_join_normal_inside.z * wall_offset * 0.5;
#endif
    gl_Position = mix(u_matrix * vec4(scaled_pos, 1), AWAY, hidden);
    h = h - ele;
    v_height = h;

#ifdef RENDER_SHADOWS
    vec3 shd_pos0 = pos;
    vec3 shd_pos1 = pos;
#ifdef NORMAL_OFFSET
    vec3 offset = shadow_normal_offset(normal);
    shd_pos0 += offset * shadow_normal_offset_multiplier0();
    shd_pos1 += offset * shadow_normal_offset_multiplier1();
#endif
    v_pos_light_view_0 = u_light_matrix_0 * vec4(shd_pos0, 1);
    v_pos_light_view_1 = u_light_matrix_1 * vec4(shd_pos1, 1);
#endif

    float NdotL = 0.0;
    float colorvalue = 0.0;
#ifndef LIGHTING_3D_MODE
    // Relative luminance (how dark/bright is the surface color?)
    colorvalue = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;

    // Add slight ambient lighting so no extrusions are totally black
    vec4 ambientlight = vec4(0.03, 0.03, 0.03, 1.0);
    color += ambientlight;

    // Calculate cos(theta), where theta is the angle between surface normal and diffuse light ray
    NdotL = clamp(dot(normal, u_lightpos), 0.0, 1.0);

    // Adjust NdotL so that
    // the range of values for highlight/shading is narrower
    // with lower light intensity
    // and with lighter/brighter surface colors
    NdotL = mix((1.0 - u_lightintensity), max((1.0 - colorvalue + u_lightintensity), 1.0), NdotL);

    // Add gradient along z axis of side surfaces
    if (normal.y != 0.0) {
        float r = 0.84;
        r = mix(0.7, 0.98, 1.0 - u_lightintensity);
        // This avoids another branching statement, but multiplies by a constant of 0.84 if no vertical gradient,
        // and otherwise calculates the gradient based on base + height
        NdotL *= (
            (1.0 - u_vertical_gradient) +
            (u_vertical_gradient * clamp((t + base) * pow(height / 150.0, 0.5), r, 1.0)));
    }
#endif // !LIGHTING_3D_MODE

#ifdef FAUX_AO
    // Documented at https://github.com/mapbox/mapbox-gl-js/pull/11926#discussion_r898496259
    float concave = pos_nx.w - floor(pos_nx.w * 0.5) * 2.0;
    float start = top_up_ny_start.w;
    float y_ground = 1.0 - clamp(t + base, 0.0, 1.0);
    float top_height = height;
#ifdef TERRAIN
    top_height = mix(max(c_ele + height, ele + base + 2.0), ele + height, float(centroid_pos.x == 0.0)) - ele;
    y_ground += y_ground * 5.0 / max(3.0, top_height);
#endif // TERRAIN
    v_ao = vec2(mix(concave, -concave, start), y_ground);
    NdotL *= (1.0 + 0.05 * (1.0 - top_up_ny.y) * u_ao[0]); // compensate sides faux ao shading contribution

#ifdef PROJECTION_GLOBE_VIEW
    top_height += u_height_lift;
#endif // PROJECTION_GLOBE_VIEW
    gl_Position.z -= (0.0000006 * (min(top_height, 500.) + 2.0 * min(base, 500.0) + 60.0 * concave + 3.0 * start)) * gl_Position.w;
#endif // FAUX_AO

#ifdef LIGHTING_3D_MODE

#ifdef FLOOD_LIGHT
    float is_wall = 1.0 - float(t > 0.0 && top_up_ny.y > 0.0);
    v_has_floodlight = float(flood_light_wall_radius > 0.0 && is_wall > 0.0);
    v_flood_radius = flood_light_wall_radius * u_vertical_scale;
#endif // FLOOD_LIGHT

    v_color = vec4(color.rgb, 1.0);
    float ndotl = calculate_NdotL(normal);
    v_flat.rgb = sRGBToLinear(color.rgb);
    v_flat.rgb = v_flat.rgb * (ndotl + (1.0 - min(ndotl * 57.29, 1.0)) * emissive_strength);
    v_flat = vec4(linearTosRGB(v_flat.rgb), 1.0);
#else // LIGHTING_3D_MODE
    // Assign final color based on surface + ambient light color, diffuse light NdotL, and light color
    // with lower bounds adjusted to hue of light
    // so that shading is tinted with the complementary (opposite) color to the light color
    v_color = vec4(0.0, 0.0, 0.0, 1.0);
    v_color.rgb += clamp(color.rgb * NdotL * u_lightcolor, mix(vec3(0.0), vec3(0.3), 1.0 - u_lightcolor), vec3(1.0));
    v_color *= u_opacity;
#endif // !LIGHTING_3D_MODE

#if defined(ZERO_ROOF_RADIUS) && !defined(LIGHTING_3D_MODE)
    float roofNdotL = clamp(u_lightpos.z, 0.0, 1.0);
    roofNdotL = mix((1.0 - u_lightintensity), max((1.0 - colorvalue + u_lightintensity), 1.0), roofNdotL);
    v_roof_color = vec4(0.0, 0.0, 0.0, 1.0);
    v_roof_color.rgb += clamp(color.rgb * roofNdotL * u_lightcolor, mix(vec3(0.0), vec3(0.3), 1.0 - u_lightcolor), vec3(1.0));
    v_roof_color *= u_opacity;
#endif // defined(ZERO_ROOF_RADIUS) && !defined(LIGHTING_3D_MODE)

#ifdef FOG
    v_fog_pos = fog_position(pos);
#endif
}
