#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_image0;
uniform sampler2D u_image1;
uniform float u_shadow_intensity;
uniform float u_texel_size;
uniform vec3 u_cascade_distances;
uniform vec3 u_lightcolor;
uniform vec3 u_lightpos;
uniform float u_lightintensity;
uniform float u_vertical_gradient;
uniform float u_opacity;
uniform float u_specular_factor;
uniform vec3 u_specular_color;

varying vec4 v_pos_light_view_0;
varying vec4 v_pos_light_view_1;
varying float v_depth;
varying highp vec3 v_normal;
varying highp vec3 v_position;

varying float v_base;
varying float v_height;
varying float v_t;

#pragma mapbox: define highp vec4 color

#define saturate(_x) clamp(_x, 0., 1.)

float unpack_depth(vec4 rgba_depth)
{
    const vec4 bit_shift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(rgba_depth, bit_shift) * 2.0 - 1.0;
}

float shadowOcclusionL1(vec4 pos, float bias) {
    pos.xyz /= pos.w;
    pos.xyz = pos.xyz * 0.5 + 0.5;
    float fragDepth = min(pos.z, 0.999);
    vec2 uv = pos.xy;
#if 1
    return step(unpack_depth(texture2D(u_image1, uv)) + bias, fragDepth);
#else
    vec2 texel = uv / u_texel_size - vec2(0.5);
    vec2 f = fract(texel);

    vec2 uv00 = (texel - f + 0.5) * u_texel_size;
    vec2 uv10 = uv00 + vec2(u_texel_size, 0);
    vec2 uv01 = uv00 + vec2(0, u_texel_size);
    vec2 uv11 = uv00 + vec2(u_texel_size, u_texel_size);

    float occlusion00 = step(unpack_depth(texture2D(u_image1, uv00)) + 0.005, fragDepth);
    float occlusion10 = step(unpack_depth(texture2D(u_image1, uv10)) + 0.005, fragDepth);
    float occlusion01 = step(unpack_depth(texture2D(u_image1, uv01)) + 0.005, fragDepth);
    float occlusion11 = step(unpack_depth(texture2D(u_image1, uv11)) + 0.005, fragDepth);

    return mix(mix(occlusion00, occlusion10, f.x), mix(occlusion01, occlusion11, f.x), f.y);
#endif
}

float shadowOcclusionL0(vec4 pos, float bias) {
    pos.xyz /= pos.w;
    pos.xyz = pos.xyz * 0.5 + 0.5;
    float fragDepth = min(pos.z, 0.999);
    vec2 uv = pos.xy;

    vec2 texel = uv / u_texel_size - vec2(1.5);
    vec2 f = fract(texel);

    float s = u_texel_size;

    // brute force sampling
    vec2 uv00 = (texel - f + 0.5) * u_texel_size;
    vec2 uv10 = uv00 + vec2(1.0 * s, 0);
    vec2 uv20 = uv00 + vec2(2.0 * s, 0);
    vec2 uv30 = uv00 + vec2(3.0 * s, 0);

    vec2 uv01 = uv00 + vec2(0.0, 1.0 * s);
    vec2 uv11 = uv01 + vec2(1.0 * s, 0);
    vec2 uv21 = uv01 + vec2(2.0 * s, 0);
    vec2 uv31 = uv01 + vec2(3.0 * s, 0);

    vec2 uv02 = uv01 + vec2(0.0, 1.0 * s);
    vec2 uv12 = uv02 + vec2(1.0 * s, 0);
    vec2 uv22 = uv02 + vec2(2.0 * s, 0);
    vec2 uv32 = uv02 + vec2(3.0 * s, 0);

    vec2 uv03 = uv02 + vec2(0.0, 1.0 * s);
    vec2 uv13 = uv03 + vec2(1.0 * s, 0);
    vec2 uv23 = uv03 + vec2(2.0 * s, 0);
    vec2 uv33 = uv03 + vec2(3.0 * s, 0);

    float o00 = step(unpack_depth(texture2D(u_image0, uv00)) + bias, fragDepth);
    float o10 = step(unpack_depth(texture2D(u_image0, uv10)) + bias, fragDepth);
    float o20 = step(unpack_depth(texture2D(u_image0, uv20)) + bias, fragDepth);
    float o30 = step(unpack_depth(texture2D(u_image0, uv30)) + bias, fragDepth);

    float o01 = step(unpack_depth(texture2D(u_image0, uv01)) + bias, fragDepth);
    float o11 = step(unpack_depth(texture2D(u_image0, uv11)) + bias, fragDepth);
    float o21 = step(unpack_depth(texture2D(u_image0, uv21)) + bias, fragDepth);
    float o31 = step(unpack_depth(texture2D(u_image0, uv31)) + bias, fragDepth);

    float o02 = step(unpack_depth(texture2D(u_image0, uv02)) + bias, fragDepth);
    float o12 = step(unpack_depth(texture2D(u_image0, uv12)) + bias, fragDepth);
    float o22 = step(unpack_depth(texture2D(u_image0, uv22)) + bias, fragDepth);
    float o32 = step(unpack_depth(texture2D(u_image0, uv32)) + bias, fragDepth);

    float o03 = step(unpack_depth(texture2D(u_image0, uv03)) + bias, fragDepth);
    float o13 = step(unpack_depth(texture2D(u_image0, uv13)) + bias, fragDepth);
    float o23 = step(unpack_depth(texture2D(u_image0, uv23)) + bias, fragDepth);
    float o33 = step(unpack_depth(texture2D(u_image0, uv33)) + bias, fragDepth);

    // Edge tap smoothing
    float value = 
        (1.0 - f.x) * (1.0 - f.y) * o00 +
        (1.0 - f.y) * (o10 + o20) +
        f.x * (1.0 - f.y) * o30 +
        (1.0 - f.x) * (o01 + o02) +
        f.x * (o31 + o32) +
        (1.0 - f.x) * f.y * o03 +
        f.y * (o13 + o23) +
        f.x * f.x * o33 +
        o11 + o21 + o12 + o22;

    return clamp(value / 9.0, 0.0, 1.0);
}



void main() {
    #pragma mapbox: initialize highp vec4 color

    highp vec3 n = normalize(v_normal);
    float NdotSL = saturate(dot(n, normalize(u_lightpos)));

    float biasT = pow(NdotSL, 1.0);
    float biasL0 = mix(0.01, 0.004, biasT);
    float biasL1 = mix(0.012, 0.004, biasT);
    float occlusionL0 = shadowOcclusionL0(v_pos_light_view_0, biasL0);
    float occlusionL1 = shadowOcclusionL1(v_pos_light_view_1, biasL1);
    float occlusion = 0.0; 

    // Alleviate projective aliasing by forcing backfacing triangles to be occluded
    float backfacing = 1.0 - step(0.1, dot(v_normal, normalize(u_lightpos)));

    if (v_depth < u_cascade_distances.x)
        occlusion = occlusionL0;
    else if (v_depth < u_cascade_distances.y)
        occlusion = occlusionL1;
    else
        occlusion = 0.0;

    highp vec3 v = normalize(-v_position);
    highp vec3 l = normalize(vec3(u_lightpos.x, u_lightpos.y, 0.2));
    // Adjust the light to match the shadows direction. Use a lower angle
    // to increase the specular effect when tilted
    highp vec3 h = normalize(v + l);

    float NdotL = saturate(dot(n, l));
    highp float NdotH = saturate(dot(n, h));

    // Add slight ambient lighting so no extrusions are totally black
    vec3 ambientTerm = 0.03 * vec3(color.rgb);

    // Relative luminance (how dark/bright is the surface color?)
    float colorvalue = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
    // Adjust directional to narrow the range of 
    // values for highlight/shading with lower light
    // intensity and with lighter/brighter colors
    float directional = mix((1.0 - u_lightintensity), max((1.0 - colorvalue + u_lightintensity), 1.0), NdotL);
    if (n.y != 0.0) {
        // This avoids another branching statement, but multiplies by a constant of 0.84 if no vertical gradient,
        // and otherwise calculates the gradient based on base + height
        directional *= (
              (1.0 - u_vertical_gradient) +
             (u_vertical_gradient * clamp((v_t + v_base) * pow(v_height / 150.0, 0.5), mix(0.7, 0.98, 1.0 - u_lightintensity), 1.0)));
    }

    // Assign directional color based on surface + ambient light color, 
    // diffuse light directional, and light color with lower bounds adjusted to hue of light
    // so that shading is tinted with the complementary (opposite) color to the light color
    vec3 diffuseTerm = clamp(directional * color.rgb * u_lightcolor, mix(vec3(0.0), vec3(0.3), 1.0 - u_lightcolor), vec3(1.0));
    vec3 specularTerm = pow(NdotH, u_specular_factor) * u_specular_color * u_lightcolor * (1.0 - u_lightintensity);
    vec3 outColor = vec3(ambientTerm + diffuseTerm + specularTerm);
    occlusion = mix(occlusion, 1.0, backfacing);
    outColor = vec3(outColor * mix(1.0, 1.0 - u_shadow_intensity, occlusion));
    outColor *= u_opacity;

#ifdef FOG
    outColor = fog_dither(fog_apply_premultiplied(outColor, v_fog_pos));
#endif
    gl_FragColor = vec4(outColor, u_opacity);

    //if (v_depth < u_cascade_distances.x)
    //    gl_FragColor = gl_FragColor * vec4(1.0, 0.5, 0.5, 1.0);
    //else if (v_depth < u_cascade_distances.y)
    //    gl_FragColor = gl_FragColor * vec4(0.5, 1.0, 0.5, 1.0);
    //else
    //    gl_FragColor = gl_FragColor * vec4(0.5, 0.5, 1.0, 1.0);
}
