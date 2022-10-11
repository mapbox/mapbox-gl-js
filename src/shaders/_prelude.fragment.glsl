// NOTE: This prelude is injected in the fragment shader only

highp vec3 hash(highp vec2 p) {
    highp vec3 p3 = fract(p.xyx * vec3(443.8975, 397.2973, 491.1871));
    p3 += dot(p3, p3.yxz + 19.19);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

vec3 dither(vec3 color, highp vec2 seed) {
    vec3 rnd = hash(seed) + hash(seed + 0.59374) - 0.5;
    return color + rnd / 255.0;
}

highp float unpack_depth(highp vec4 rgba_depth)
{
    const highp vec4 bit_shift = vec4(1.0 / (255.0 * 255.0 * 255.0), 1.0 / (255.0 * 255.0), 1.0 / 255.0, 1.0);
    return dot(rgba_depth, bit_shift) * 2.0 - 1.0;
}

// Pack depth to RGBA. A piece of code copied in various libraries and WebGL
// shadow mapping examples.
// https://aras-p.info/blog/2009/07/30/encoding-floats-to-rgba-the-final/
highp vec4 pack_depth(highp float ndc_z) {
    highp float depth = ndc_z * 0.5 + 0.5;
    const highp vec4 bit_shift = vec4(255.0 * 255.0 * 255.0, 255.0 * 255.0, 255.0, 1.0);
    const highp vec4 bit_mask  = vec4(0.0, 1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0);
    highp vec4 res = fract(depth * bit_shift);
    res -= res.xxyz * bit_mask;
    return res;
}

highp vec3 lighting_model(highp vec3 color, highp vec3 ambient_light, highp vec3 sun_color, highp vec3 sun_dir, highp vec3 cam_fwd) {
    highp float NdotL = sun_dir.z;  // vec3(0, 0, 1) * sun_dir
    highp vec3 indirect_color = color * ambient_light;
    highp vec3 direct_color = color * sun_color * NdotL;

    //return vec4((indirect_color + direct_color) / 3.141592653589793, color.w);
    return indirect_color + direct_color;
}

highp vec4 lighting_model(highp vec4 color, highp vec3 ambient_light, highp vec3 sun_color, highp vec3 sun_dir, highp vec3 cam_fwd) {
    return vec4(lighting_model(color.rgb, ambient_light, sun_color, sun_dir, cam_fwd), color.w);
}


const float M_PI = 3.141592653589793;

#define saturate(_x) clamp(_x, 0., 1.)


struct Material {
    float perceptualRoughness;
    float alphaRoughness;
    float metallic;
    vec3 f90;
    vec4 baseColor;
    vec3 diffuseColor;
    vec3 specularColor;
    highp vec3 normal;
};

Material getPBRMaterial(vec4 color, float metallicFactor, float roughnessFactor) {
    Material mat;
    mat.baseColor = color;
    mat.perceptualRoughness = roughnessFactor;
    mat.metallic = metallicFactor;

    const float c_minRoughness = 0.04;
    mat.perceptualRoughness = clamp(mat.perceptualRoughness, c_minRoughness, 1.0);
    mat.metallic = saturate(mat.metallic);

    mat.alphaRoughness = mat.perceptualRoughness * mat.perceptualRoughness;
    // Default reflectance off dielectric materials on 0 angle
    // const vec3 f0 = vec3(0.04);
    // remove default reflectance to achieve a similar effect we have with diffuse lighting
    const vec3 f0 = vec3(0.0);

    mat.diffuseColor = mat.baseColor.rgb * (vec3(1.0) - f0);
    mat.diffuseColor *= 1.0 - mat.metallic;

    mat.specularColor = mix(f0, mat.baseColor.rgb, mat.metallic);

    highp float reflectance = max(max(mat.specularColor.r, mat.specularColor.g), mat.specularColor.b);
    // For typical incident reflectance range (between 4% to 100%) set the grazing reflectance to 100% for typical fresnel effect.
    // For very low reflectance range on highly diffuse objects (below 4%), incrementally reduce grazing reflecance to 0%.
    highp float reflectance90 = saturate(reflectance * 25.0);
    mat.f90 = vec3(reflectance90);

    mat.normal = vec3(0.0, 0.0, 1.0);
    return mat;
}

// Environment BRDF approximation (Unreal 4 approach)
vec3 EnvBRDFApprox(vec3 specularColor, float roughness,highp float NdotV) {
    vec4 c0 = vec4(-1, -0.0275, -0.572, 0.022);
    vec4 c1 = vec4(1, 0.0425, 1.04, -0.04);
    highp vec4 r = roughness * c0 + c1;
    highp float a004 = min(r.x * r.x, exp2(-9.28 * NdotV)) * r.x + r.y;
    vec2 AB = vec2(-1.04, 1.04) * a004 + r.zw;
    return specularColor * AB.x + AB.y;
}

vec3 computeIndirectLightContribution(Material mat, float NdotV, vec3 ambientColor) {
   vec3 envBRDF = EnvBRDFApprox(mat.specularColor, mat.perceptualRoughness, NdotV);
   vec3 indirectSpecular = envBRDF * ambientColor;
   vec3 indirectDiffuse = mat.diffuseColor * ambientColor;
   return indirectSpecular + indirectDiffuse;
}

vec3 diffuseLambertian(Material mat) {
    return mat.diffuseColor; // TODO: "true" PBR needs this -> / M_PI;
}

// Normal distribution function
float D_GGX(highp float NdotH, float alphaRoughness) {
    highp float a4 = alphaRoughness * alphaRoughness;
    highp float f = (NdotH * a4 -NdotH) * NdotH + 1.0;
    return a4 / (M_PI * f * f);
}

// From https://google.github.io/filament/Filament.md.html#materialsystem/specularbrdf/geometricshadowing
float V_GGXFast(float NdotL, float NdotV, float roughness) {
    float a = roughness;
    float GGXV = NdotL * (NdotV * (1.0 - a) + a);
    float GGXL = NdotV * (NdotL * (1.0 - a) + a);
    return 0.5 / (GGXV + GGXL);
}

// Shlick approximation for fresnel reflectance
vec3 F_SchlickFast(vec3 specularColor, float VdotH) {
    float x = 1.0 - VdotH;
    float x4 = x * x * x * x;
    return specularColor + (1.0 - specularColor) * x4 * x;
}

vec3 computeLightContribution(Material mat, vec3 position, vec3 lightDir, vec3 lightColor, vec3 ambientColor) {
    highp vec3 n = mat.normal;
    highp vec3 v = normalize(-position);
    highp vec3 l = normalize(lightDir);
    highp vec3 h = normalize(v + l);

    vec3 reflection = -normalize(reflect(v, n));

    // Avoid dividing by zero when the dot product is zero
    float NdotV = clamp(abs(dot(n, v)), 0.001, 1.0);
    float NdotL = clamp(dot(n, l), 0.001, 1.0);
    highp float NdotH = saturate(dot(n, h));
    float VdotH = saturate(dot(v, h));

    // From https://google.github.io/filament/Filament.md.html#materialsystem/standardmodelsummary
    // Cook-Torrance explanation:
    // https://www.shadertoy.com/view/4sSfzK

    // specular reflection
    vec3 f = F_SchlickFast(mat.specularColor, VdotH);
    // geometric occlusion
    float g = V_GGXFast(NdotL, NdotV, mat.alphaRoughness);
    // microfacet distribution
    float d = D_GGX(NdotH, mat.alphaRoughness);
    // Lambertian diffuse brdf
    vec3 diffuseTerm = (1.0 - f) * diffuseLambertian(mat);
    // Cook-Torrance BRDF
    vec3 specularTerm = f * g * d;

    vec3 directLightColor = (specularTerm + diffuseTerm) * NdotL * lightColor;
    vec3 indirectLightColor = computeIndirectLightContribution(mat, NdotV, ambientColor);

    return (directLightColor + indirectLightColor);
}
