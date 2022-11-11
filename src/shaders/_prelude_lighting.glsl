#ifdef LIGHTING_3D_MODE

uniform vec3 u_lighting_ambient_color;
uniform vec3 u_lighting_directional_dir;        // Direction towards the light source
uniform vec3 u_lighting_directional_color;

vec3 apply_lighting(vec3 color) {
    float NdotL = u_lighting_directional_dir.z;
    return color * (u_lighting_ambient_color + u_lighting_directional_color * NdotL);
}

vec4 apply_lighting(vec4 color) {
    return vec4(apply_lighting(color.rgb), color.a);
}

#endif
