varying vec4 v_color;

#ifdef RENDER_SHADOWS
varying highp vec4 v_pos_light_view_0;
varying highp vec4 v_pos_light_view_1;
varying float v_depth;
#endif

#ifdef FAUX_AO
uniform lowp vec2 u_ao;
varying vec3 v_ao;
#endif

#ifdef ZERO_ROOF_RADIUS
varying vec4 v_roof_color;
#endif

#if defined(ZERO_ROOF_RADIUS) || defined(RENDER_SHADOWS)
varying highp vec3 v_normal;
#endif

void main() {

#if defined(ZERO_ROOF_RADIUS) || defined(RENDER_SHADOWS)
    vec3 normal = v_normal;
#endif

float z;
vec4 color;
#ifdef ZERO_ROOF_RADIUS
    z = float(normal.z > 0.00001);
    color = mix(v_color, v_roof_color, z);
#else
    color = v_color;
#endif
#ifdef FAUX_AO
    float intensity = u_ao[0];
    float h = max(0.0, v_ao.z);
    float h_floors = h / u_ao[1];
    float y_shade = 1.0 - 0.9 * intensity * min(v_ao.y, 1.0);
    float shade = (1.0 - 0.08 * intensity) * (y_shade + (1.0 - y_shade) * (1.0 - pow(1.0 - min(h_floors / 16.0, 1.0), 16.0))) + 0.08 * intensity * min(h_floors / 160.0, 1.0);
    // concave angle
    float concave = v_ao.x * v_ao.x;
#ifdef ZERO_ROOF_RADIUS
    concave *= (1.0 - z);
#endif
    float x_shade = mix(1.0, mix(0.6, 0.75, min(h_floors / 30.0, 1.0)), intensity) + 0.1 * intensity * min(h, 1.0);
    shade *= mix(1.0, x_shade * x_shade * x_shade, concave);
    color.rgb = color.rgb * shade;
#endif

#ifdef RENDER_SHADOWS
#ifdef ZERO_ROOF_RADIUS
    normal = mix(normal, vec3(0.0, 0.0, 1.0), z);
#endif
    color.xyz = shadowed_color_normal(color.xyz, normalize(normal), v_pos_light_view_0, v_pos_light_view_1, v_depth);
#endif

#ifdef FOG
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos));
#endif
    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
