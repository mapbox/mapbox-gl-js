#ifdef RENDER_SHADOWS

uniform mediump vec3 u_shadow_direction;
uniform highp vec3 u_shadow_normal_offset; // [tileToMeter, offsetCascade0, offsetCascade1]

vec3 shadow_normal_offset(vec3 normal) {
    float tileInMeters = u_shadow_normal_offset[0];
    // -xy is because fill extrusion normals point toward inside. This is why
    // e.g. vec3 transformed_normal = vec3(-normal.xy, normal.z) is used in 3D lighting
    // for model layer when needed to apply the same lighting as for fill extrusions.
    vec3 n = vec3(-normal.xy, tileInMeters * normal.z);
    float dotScale = min(1.0 - dot(normal, u_shadow_direction), 1.0) * 0.5 + 0.5;
    return n * dotScale;
}

vec3 shadow_normal_offset_model(vec3 normal) {
    vec3 transformed_normal = vec3(-normal.xy, normal.z);
    float NDotL = dot(normalize(transformed_normal), u_shadow_direction);
    float dotScale = min(1.0 - NDotL, 1.0) * 0.5 + 0.5;
    return normal * dotScale;
}

float shadow_normal_offset_multiplier0() {
    return u_shadow_normal_offset[1];
}

float shadow_normal_offset_multiplier1() {
    return u_shadow_normal_offset[2];
}

#endif // RENDER_SHADOWS
