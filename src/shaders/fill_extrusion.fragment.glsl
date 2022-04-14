

uniform lowp vec3 u_lightpos;

varying vec4 v_pos_light_view_0;
varying vec4 v_pos_light_view_1;
varying vec4 v_color;
varying float v_depth;
varying vec3 v_normal;

#ifdef FAUX_AO
uniform lowp vec2 u_ao;
varying vec3 v_ao;
#endif

void main() {
    vec4 color = v_color;
#ifdef FAUX_AO
    float intensity = u_ao[0];
    float h = max(0.0, v_ao.z);
    float h_floors = h / u_ao[1];
    float y_shade = 1.0 - 0.9 * intensity * min(v_ao.y, 1.0);
    float shade = (1.0 - 0.08 * intensity) * (y_shade + (1.0 - y_shade) * (1.0 - pow(1.0 - min(h_floors / 16.0, 1.0), 16.0))) + 0.08 * intensity * min(h_floors / 160.0, 1.0);
    // concave angle
    float concave = v_ao.x * v_ao.x;
    float x_shade = mix(1.0, mix(0.6, 0.75, min(h_floors / 30.0, 1.0)), intensity) + 0.1 * intensity * min(h, 1.0);
    shade *= mix(1.0, x_shade * x_shade * x_shade, concave);
    color.rgb = color.rgb * shade;
#endif

#ifdef RENDER_SHADOWS
    highp vec3 n = normalize(v_normal);
    vec3 lightdir = normalize(u_lightpos);
    float NDotL = clamp(dot(n, lightdir), 0.0, 1.0);

    float biasT = pow(NDotL, 1.0);
    float biasL0 = mix(0.02, 0.008, biasT);
    float biasL1 = mix(0.02, 0.008, biasT);
    float occlusionL0 = shadowOcclusionL0(v_pos_light_view_0, biasL0);
    float occlusionL1 = shadowOcclusionL1(v_pos_light_view_1, biasL1);
    float occlusion = 0.0; 

    // Alleviate projective aliasing by forcing backfacing triangles to be occluded
    float backfacing = 1.0 - smoothstep(0.0, 0.1, NDotL);

    if (v_depth < u_cascade_distances.x)
        occlusion = occlusionL0;
    else if (v_depth < u_cascade_distances.y)
        occlusion = occlusionL1;

    occlusion = mix(occlusion, 1.0, backfacing);
    color.xyz = color.xyz * mix(1.0, 1.0 - u_shadow_intensity, occlusion);
#endif

#ifdef FOG
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos)).rgb;
#endif
    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
