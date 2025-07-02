in vec3 a_pos_3f;

#pragma mapbox: define-attribute-vertex-shader-only highp vec2 part_color_emissive
#pragma mapbox: define-attribute highp vec4 bloom_attenuation

out vec4 v_color_emissive;

uniform mat4 u_matrix;

vec3 sRGBToLinear(vec3 srgbIn) {
    return pow(srgbIn, vec3(2.2));
}

void main() {
    #pragma mapbox: initialize-attribute-custom highp vec2 part_color_emissive
    #pragma mapbox: initialize-attribute highp vec4 bloom_attenuation

#ifdef HAS_ATTRIBUTE_a_part_color_emissive
    vec4 color_emissive = decode_color(part_color_emissive);
    float part_emissive = color_emissive.a * 5.0; // The emissive value was compressed from [0,5] to [0,1]
    v_color_emissive = vec4(sRGBToLinear(color_emissive.rgb), part_emissive);
#else
    v_color_emissive = vec4(1.0);
#endif

    gl_Position = u_matrix * vec4(a_pos_3f, 1.0);
}
