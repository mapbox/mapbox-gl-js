varying vec4 v_color;

#ifdef RENDER_SHADOWS
varying highp vec4 v_pos_light_view_0;
varying highp vec4 v_pos_light_view_1;
varying float v_depth;
#endif

uniform lowp float u_opacity;

#ifdef FAUX_AO
uniform lowp vec2 u_ao;
varying vec2 v_ao;
#endif

#if defined(ZERO_ROOF_RADIUS) && !defined(LIGHTING_3D_MODE)
varying vec4 v_roof_color;
#endif

#if defined(ZERO_ROOF_RADIUS) || defined(RENDER_SHADOWS) || defined(LIGHTING_3D_MODE)
varying highp vec3 v_normal;
#endif

uniform vec3 u_flood_light_color;
uniform highp float u_vertical_scale;
uniform float u_flood_light_intensity;

#if defined(LIGHTING_3D_MODE) && defined(FLOOD_LIGHT)
varying float v_flood_radius;
varying float v_has_floodlight;
#endif

varying float v_height;

void main() {

#if defined(ZERO_ROOF_RADIUS) || defined(RENDER_SHADOWS) || defined(LIGHTING_3D_MODE)
    vec3 normal = normalize(v_normal);
#endif

float z;
vec4 color = v_color;
#ifdef ZERO_ROOF_RADIUS
    z = float(normal.z > 0.00001);
#ifdef LIGHTING_3D_MODE
    normal = mix(normal, vec3(0.0, 0.0, 1.0), z);
#else // LIGHTING_3D_MODE
    color = mix(v_color, v_roof_color, z);
#endif // !LIGHTING_3D_MODE
#endif // ZERO_ROOF_RADIUS

float h = max(0.0, v_height);
float ao_shade = 1.0;
#ifdef FAUX_AO
    float intensity = u_ao[0];
    float h_floors = h / (u_ao[1] * u_vertical_scale);
    float y_shade = 1.0 - 0.9 * intensity * min(v_ao.y, 1.0);
    ao_shade = (1.0 - 0.08 * intensity) * (y_shade + (1.0 - y_shade) * (1.0 - pow(1.0 - min(h_floors / 16.0, 1.0), 16.0))) + 0.08 * intensity * min(h_floors / 160.0, 1.0);
    // concave angle
    float concave = v_ao.x * v_ao.x;
#ifdef ZERO_ROOF_RADIUS
    concave *= (1.0 - z);
#endif
    float x_shade = mix(1.0, mix(0.6, 0.75, min(h_floors / 30.0, 1.0)), intensity) + 0.1 * intensity * min(h, 1.0);
    ao_shade *= mix(1.0, x_shade * x_shade * x_shade, concave);

#ifdef LIGHTING_3D_MODE
#ifdef FLOOD_LIGHT
    color.rgb *= mix(ao_shade, 1.0, v_has_floodlight); // flood light and AO are mutually exclusive effects.
#else // FLOOD_LIGHT
    color.rgb *= ao_shade;
#endif // !FLOOD_LIGHT
#else // LIGHTING_3D_MODE
    color.rgb *= ao_shade;
#endif // !LIGHTING_3D_MODE

#endif // FAUX_AO

#ifdef LIGHTING_3D_MODE
#ifdef RENDER_SHADOWS
    float lighting_factor = shadowed_light_factor_normal(normal, v_pos_light_view_0, v_pos_light_view_1, v_depth);
    color.rgb = apply_lighting(color.rgb, normal, lighting_factor);
#else // RENDER_SHADOWS
    color.rgb = apply_lighting(color.rgb, normal);
#endif // !RENDER_SHADOWS

#ifdef FLOOD_LIGHT
    float flood_radiance = (1.0 - min(h / v_flood_radius, 1.0)) * u_flood_light_intensity * v_has_floodlight;
    color.rgb = mix(color.rgb, u_flood_light_color * u_opacity, flood_radiance);
#endif // FLOOD_LIGHT

    color *= u_opacity;
#endif // LIGHTING_3D_MODE

#ifdef FOG
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos));
#endif

#ifdef INDICATOR_CUTOUT
    color = applyCutout(color);
#endif

    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
