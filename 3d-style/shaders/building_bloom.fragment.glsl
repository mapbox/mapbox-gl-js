in vec4 v_color_emissive;

#pragma mapbox: define-attribute highp vec4 bloom_attenuation
#pragma mapbox: initialize-attribute highp vec4 bloom_attenuation

float saturate(float val) {
    return clamp(val, 0.0, 1.0);
}

void main() {
    float emission = v_color_emissive.a;
    float opacity = 1.0;

#ifdef HAS_ATTRIBUTE_a_bloom_attenuation
    // a_bloom_attenuation is used to pass information about light geometry.
    // calculate distance to line segment, multiplier 1.3 additionally deattenuates towards extruded corners.
    float distance = length(vec2(1.3 * max(0.0, abs(bloom_attenuation.x) - bloom_attenuation.z), bloom_attenuation.y));
    distance +=  mix(0.5, 0.0, clamp(emission - 1.0, 0.0, 1.0));
    opacity *= saturate(1.0 - distance * distance);
#endif

    glFragColor = vec4(v_color_emissive.rgb, 1.0) * opacity;
}
