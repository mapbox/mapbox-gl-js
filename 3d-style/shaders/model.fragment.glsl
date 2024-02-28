#include "_prelude_fog.fragment.glsl"
#include "_prelude_shadow.fragment.glsl"
#include "_prelude_lighting.glsl"

uniform float u_opacity;

uniform vec3 u_lightcolor;
uniform vec3 u_lightpos;
uniform float u_lightintensity;

uniform vec4 u_baseColorFactor;
uniform vec4 u_emissiveFactor;
uniform float u_metallicFactor;
uniform float u_roughnessFactor;
uniform float u_emissive_strength;


in highp vec4 v_position_height;
in lowp vec4 v_color_mix;

#ifdef RENDER_SHADOWS
in vec4 v_pos_light_view_0;
in vec4 v_pos_light_view_1;
in float v_depth_shadows;
#endif

#ifdef OCCLUSION_TEXTURE_TRANSFORM
// offset[0], offset[1], scale[0], scale[1]
uniform vec4 u_occlusionTextureTransform;
#endif

#pragma mapbox: define-attribute highp vec3 normal_3f
#pragma mapbox: define-attribute highp vec3 color_3f
#pragma mapbox: define-attribute highp vec4 color_4f
#pragma mapbox: define-attribute highp vec2 uv_2f

#pragma mapbox: initialize-attribute highp vec3 normal_3f
#pragma mapbox: initialize-attribute highp vec3 color_3f
#pragma mapbox: initialize-attribute highp vec4 color_4f
#pragma mapbox: initialize-attribute highp vec2 uv_2f

#ifdef HAS_ATTRIBUTE_a_pbr
in lowp vec4 v_roughness_metallic_emissive_alpha;
in mediump vec4 v_height_based_emission_params;
#endif

#ifdef HAS_TEXTURE_u_baseColorTexture
uniform sampler2D u_baseColorTexture;
uniform bool u_baseTextureIsAlpha;
uniform bool u_alphaMask;
uniform float u_alphaCutoff;
#endif

#ifdef HAS_TEXTURE_u_metallicRoughnessTexture
uniform sampler2D u_metallicRoughnessTexture;
#endif
#ifdef HAS_TEXTURE_u_occlusionTexture
uniform sampler2D u_occlusionTexture;
uniform float u_aoIntensity;
#endif
#ifdef HAS_TEXTURE_u_normalTexture
uniform sampler2D u_normalTexture;
#endif
#ifdef HAS_TEXTURE_u_emissionTexture
uniform sampler2D u_emissionTexture;
#endif

#ifdef TERRAIN_FRAGMENT_OCCLUSION
in highp float v_depth;
uniform sampler2D u_depthTexture;
uniform vec2 u_inv_depth_size;

bool isOccluded() {
    vec2 coord = gl_FragCoord.xy * u_inv_depth_size;
    highp float depth = unpack_depth(texture(u_depthTexture, coord));
    // Add some marging to avoid depth precision issues
    return v_depth > depth + 0.0005;
}
#endif

#define saturate(_x) clamp(_x, 0., 1.)

// linear to sRGB approximation
vec3 linearTosRGB(vec3 color) {
    return pow(color, vec3(1./2.2));
}
vec3 sRGBToLinear(vec3 srgbIn) {
    return pow(srgbIn, vec3(2.2));
}

float calculate_NdotL(vec3 normal, vec3 lightDir) {
    // Use slightly modified dot product for lambertian diffuse shading. This increase the range of NdotL to cover surfaces facing up to 45 degrees away from the light source.
    // This allows us to trade some realism for performance/usability as a single light source is enough to shade the scene.
    const float ext = 0.70710678118; // acos(pi/4)
    return (clamp(dot(normal, lightDir), -ext, 1.0) + ext) / (1.0 + ext);
}

vec3 getDiffuseShadedColor(vec3 albedo, vec3 normal, vec3 lightDir, vec3 lightColor)
{
#ifdef LIGHTING_3D_MODE
    vec3 transformed_normal = vec3(-normal.xy, normal.z);
    float lighting_factor;
#ifdef RENDER_SHADOWS
    lighting_factor = shadowed_light_factor_normal(transformed_normal, v_pos_light_view_0, v_pos_light_view_1, v_depth_shadows);
#else // RENDER_SHADOWS
    lighting_factor = saturate(dot(transformed_normal, u_lighting_directional_dir));
#endif // !RENDER_SHADOWS
    return apply_lighting(albedo, transformed_normal, lighting_factor);

#else // LIGHTING_3D_MODE
    vec3 n = normal;
    // Computation from fill extrusion vertex shader
    float colorvalue = ((albedo.x * 0.2126) + (albedo.y * 0.7152)) + (albedo.z * 0.0722);
    vec3 c = vec3(0.03, 0.03, 0.03);
    float directional = clamp(dot(n, vec3(lightDir)), 0.0, 1.0);
    directional = mix(1.0 - u_lightintensity, max((1.0 - colorvalue) + u_lightintensity, 1.0), directional);
    vec3 c3 = c + clamp((albedo * directional) * lightColor, mix(vec3(0.0), vec3(0.3), vec3(1.0) - lightColor), vec3(1.0));
    return c3;
#endif // !LIGHTING_3D_MODE
}

vec4 getBaseColor() {
    vec4 albedo = u_baseColorFactor;
    // vertexColor
#ifdef HAS_ATTRIBUTE_a_color_3f
    albedo *= vec4(color_3f, 1.0);
#endif

#ifdef HAS_ATTRIBUTE_a_pbr
#else
#ifdef HAS_ATTRIBUTE_a_color_4f
    albedo *= color_4f;
#endif
#endif

    // texture Color
#if defined (HAS_TEXTURE_u_baseColorTexture) && defined (HAS_ATTRIBUTE_a_uv_2f)
    vec4 texColor = texture(u_baseColorTexture, uv_2f);
    if(u_alphaMask) {
        if (texColor.w < u_alphaCutoff) {
            discard;
        }
    }

#ifdef UNPREMULT_TEXTURE_IN_SHADER
    // Unpremultiply alpha for decals and opaque materials.
    if(texColor.w > 0.0) {
        texColor.rgb /= texColor.w;
    }
    texColor.w = 1.0;
#endif

    if(u_baseTextureIsAlpha) {
        if (texColor.r < 0.5) {
            discard;
        }
    } else {
        // gltf material
        texColor.rgb = sRGBToLinear(texColor.rgb);
        albedo *= texColor;
    }
#endif
    return vec4(mix(albedo.rgb, v_color_mix.rgb, v_color_mix.a), albedo.a);
}

// From http://www.thetenthplanet.de/archives/1180
// Normal mapping without precomputed tangents
highp mat3 cotangentFrame(highp vec3 N, highp vec3 p, highp vec2 uv ) {
    #ifdef HAS_TEXTURE_u_normalTexture
    // get edge vectors of the pixel triangle
    highp vec3 dp1 = vec3(dFdx(p.x), dFdx(p.y), dFdx(p.z));
    highp vec3 dp2 = vec3(dFdy(p.x), dFdy(p.y), dFdy(p.z));

    highp vec2 duv1 = vec2(dFdx(uv.x), dFdx(uv.y));
    highp vec2 duv2 = vec2(dFdy(uv.x), dFdy(uv.y));

    // solve the linear system
    highp vec3 dp2perp = cross( dp2, N );
    highp vec3 dp1perp = cross( N, dp1 );
    highp vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    highp vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
    // construct a scale-invariant frame
    // Some Adrenos GPU needs to set explicitely highp
    highp float lengthT = dot(T,T);
    highp float lengthB = dot(B,B);
    highp float maxLength = max(lengthT, lengthB);
    highp float invmax = inversesqrt( maxLength );
    highp mat3 res = mat3( T * invmax, B * invmax, N );
    return res;
    #else
    return mat3(1.0);
    #endif
}

highp vec3 getNormal(){
    highp vec3 n;
#ifdef HAS_ATTRIBUTE_a_normal_3f
    n = normalize(normal_3f);
#else
    // Workaround for Adreno GPUs not able to do dFdx( v_position_height )
    // three.js/.../normal_fragment_begin.glsl.js
    highp vec3 fdx = vec3(dFdx(v_position_height.x), dFdx(v_position_height.y), dFdx(v_position_height.z));
    highp vec3 fdy = vec3(dFdy(v_position_height.x), dFdy(v_position_height.y), dFdy(v_position_height.z));
    // Z flipped so it is towards the camera.
    n = normalize(cross(fdx,fdy)) * -1.0;
#endif

#if defined(HAS_TEXTURE_u_normalTexture) && defined(HAS_ATTRIBUTE_a_uv_2f)
    // Perturb normal
    vec3 nMap = texture( u_normalTexture, uv_2f).xyz;
    nMap = normalize(2.0* nMap - vec3(1.0));
    highp vec3 v = normalize(-v_position_height.xyz);
    highp mat3 TBN = cotangentFrame(n, v, uv_2f);
    n = normalize(TBN * nMap);
#endif

    return n;
}

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

Material getPBRMaterial() {
    Material mat;
    mat.baseColor = getBaseColor();
    mat.perceptualRoughness = u_roughnessFactor;
    mat.metallic = u_metallicFactor;
#ifdef HAS_ATTRIBUTE_a_pbr
    mat.perceptualRoughness = v_roughness_metallic_emissive_alpha.x;
    mat.metallic = v_roughness_metallic_emissive_alpha.y;
    mat.baseColor.w *= v_roughness_metallic_emissive_alpha.w;
#endif
#if defined(HAS_TEXTURE_u_metallicRoughnessTexture) && defined(HAS_ATTRIBUTE_a_uv_2f) 
    vec4 mrSample = texture(u_metallicRoughnessTexture, uv_2f);
    mat.perceptualRoughness *= mrSample.g;
    mat.metallic *= mrSample.b;
#endif
    const float c_minRoughness = 0.04;
    mat.perceptualRoughness = clamp(mat.perceptualRoughness, c_minRoughness, 1.0);
    mat.metallic = saturate(mat.metallic);

    mat.alphaRoughness = mat.perceptualRoughness * mat.perceptualRoughness;
    // Default reflectance off dielectric materials on 0 angle
    const vec3 f0 = vec3(0.04);

    mat.diffuseColor = mat.baseColor.rgb * (vec3(1.0) - f0);
    mat.diffuseColor *= 1.0 - mat.metallic;

    mat.specularColor = mix(f0, mat.baseColor.rgb, mat.metallic);

    highp float reflectance = max(max(mat.specularColor.r, mat.specularColor.g), mat.specularColor.b);
    // For typical incident reflectance range (between 4% to 100%) set the grazing reflectance to 100% for typical fresnel effect.
    // For very low reflectance range on highly diffuse objects (below 4%), incrementally reduce grazing reflecance to 0%.
    highp float reflectance90 = saturate(reflectance * 25.0);
    mat.f90 = vec3(reflectance90);

    mat.normal = getNormal();
    return mat;
}

// Smith Joint visibility for geometric occlusion term (V = G / (4 * NdotL * NdotV))
float V_GGX(float NdotL, float NdotV, float roughness)
{
    float a2 = roughness * roughness;
    float GGXV = NdotL * sqrt(NdotV * NdotV * (1.0 - a2) + a2);
    float GGXL = NdotV * sqrt(NdotL * NdotL * (1.0 - a2) + a2);
    return 0.5 / (GGXV + GGXL);
}

// From https://google.github.io/filament/Filament.md.html#materialsystem/specularbrdf/geometricshadowing
float V_GGXFast(float NdotL, float NdotV, float roughness) {
    float a = roughness;
    float GGXV = NdotL * (NdotV * (1.0 - a) + a);
    float GGXL = NdotV * (NdotL * (1.0 - a) + a);
    return 0.5 / (GGXV + GGXL);
}

// The following equation models the Fresnel reflectance term of the spec equation (aka F())
// If we are fill limited we could use the previous shlick approximation
vec3 F_Schlick(vec3 specularColor, vec3 f90, float VdotH)
{
    return specularColor + (f90 - specularColor) * pow(clamp(1.0 - VdotH, 0.0, 1.0), 5.0);
}

// Shlick approximation for fresnel reflectance
vec3 F_SchlickFast(vec3 specularColor, float VdotH)
{
    float x = 1.0 - VdotH;
    float x4 = x * x * x * x;
    return specularColor + (1.0 - specularColor) * x4 * x;
}

// Normal distribution function
float D_GGX(highp float NdotH, float alphaRoughness)
{
    highp float a4 = alphaRoughness * alphaRoughness;
    highp float f = (NdotH * a4 -NdotH) * NdotH + 1.0;
    return a4 / (PI * f * f);
}

// Disney Implementation of diffuse from Physically-Based Shading at Disney by Brent Burley. See Section 5.3.
// http://blog.selfshadow.com/publications/s2012-shading-course/burley/s2012_pbs_disney_brdf_notes_v3.pdf
vec3 diffuseBurley(Material mat, float LdotH, float NdotL, float NdotV)
{
    float f90 = 2.0 * LdotH * LdotH * mat.alphaRoughness - 0.5;

    return (mat.diffuseColor / PI) * (1.0 + f90 * pow((1.0 - NdotL), 5.0)) * (1.0 + f90 * pow((1.0 - NdotV), 5.0));
}

vec3 diffuseLambertian(Material mat)
{

#ifdef LIGHTING_3D_MODE
    // remove the PI division to achieve more integrated colors
    return mat.diffuseColor;
#else
    return mat.diffuseColor / PI;
#endif

}


// Environment BRDF approximation (Unreal 4 approach)
vec3 EnvBRDFApprox(vec3 specularColor, float roughness,highp float NdotV)
{
    vec4 c0 = vec4(-1, -0.0275, -0.572, 0.022);
    vec4 c1 = vec4(1, 0.0425, 1.04, -0.04);
    highp vec4 r = roughness * c0 + c1;
    highp float a004 = min(r.x * r.x, exp2(-9.28 * NdotV)) * r.x + r.y;
    vec2 AB = vec2(-1.04, 1.04) * a004 + r.zw;
    return specularColor * AB.x + AB.y;
}

vec3 computeIndirectLightContribution(Material mat, float NdotV, vec3 normal)
{
    vec3 env_light = vec3(0.65, 0.65, 0.65);
#ifdef LIGHTING_3D_MODE
    float ambient_factor = calculate_ambient_directional_factor(normal);
    env_light = u_lighting_ambient_color * ambient_factor;
#endif
    vec3 envBRDF = EnvBRDFApprox(mat.specularColor, mat.perceptualRoughness, NdotV);
    vec3 indirectSpecular =  envBRDF * env_light;
    vec3 indirectDiffuse = mat.diffuseColor * env_light;
    return indirectSpecular + indirectDiffuse;
}


vec3 computeLightContribution(Material mat, vec3 lightPosition, vec3 lightColor)
{
    highp vec3 n = mat.normal;
    highp vec3 v = normalize(-v_position_height.xyz);
    highp vec3 l = normalize(lightPosition);
    highp vec3 h = normalize(v + l);

    // Avoid dividing by zero when the dot product is zero
    float NdotV = clamp(abs(dot(n, v)), 0.001, 1.0);
    float NdotL = saturate(dot(n, l));
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
    //float d = D_GGXFast(n, NdotH, mat.alphaRoughness, h);
    // Lambertian diffuse brdf
    vec3 diffuseTerm = (1.0 - f) * diffuseLambertian(mat);
    // Cook-Torrance BRDF
    vec3 specularTerm = f * g * d;

    vec3 transformed_normal = vec3(-n.xy, n.z);

    float lighting_factor;
#ifdef RENDER_SHADOWS
    lighting_factor = shadowed_light_factor_normal(transformed_normal, v_pos_light_view_0, v_pos_light_view_1, v_depth_shadows);
#else
    lighting_factor = NdotL;
#endif // RENDER_SHADOWS

    vec3 directLightColor = (specularTerm + diffuseTerm) * lighting_factor * lightColor;
    vec3 indirectLightColor = computeIndirectLightContribution(mat, NdotV, transformed_normal);

    vec3 color = (saturate(directLightColor) + indirectLightColor);

    float intensityFactor = 1.0;
#if !defined(LIGHTING_3D_MODE)
    const vec3 luminosityFactor = vec3(0.2126, 0.7152, 0.0722);

    // Calculate luminance
    float luminance = dot(diffuseTerm, luminosityFactor);
    // Adjust light intensity depending on light incidence
    intensityFactor = mix((1.0 - u_lightintensity), max((1.0 - luminance + u_lightintensity), 1.0), NdotL);
#endif // !defined(LIGHTING_3D_MODE)

    color *= intensityFactor;
    return color;
}

void main() {

#ifdef TERRAIN_FRAGMENT_OCCLUSION
    if (isOccluded()) {
        discard;
    }
#endif

    vec3 lightDir = u_lightpos;
    vec3 lightColor = u_lightcolor;

#ifdef LIGHTING_3D_MODE
    lightDir = u_lighting_directional_dir;
    // invert xy  as they are flipped for fill extrusion normals (compared to expected here) and,
    // as a new citizen, better to not change legacy code convention.
    lightDir.xy = -lightDir.xy;
    lightColor = u_lighting_directional_color;
#endif

vec4 finalColor;
#ifdef DIFFUSE_SHADED
    vec3 N = getNormal();
    vec3 baseColor = getBaseColor().rgb;
    vec3 diffuse = getDiffuseShadedColor(baseColor, N, lightDir, lightColor);
    // Ambient Occlusion
#ifdef HAS_TEXTURE_u_occlusionTexture
    // For b3dm tiles where models contains occlusion textures we interpret them similarly to how
    // we handle baseColorTexture as an alpha mask (i.e one channel).
    // This is why we read the alpha component here (refer to getBaseColor to see how baseColorTexture.w is used to implement alpha masking).
    float ao = (texture(u_occlusionTexture, uv_2f).r - 1.0) * u_aoIntensity + 1.0;
    diffuse *= ao;
#endif
    finalColor = vec4(mix(diffuse, baseColor, u_emissive_strength), 1.0) * u_opacity;
#else // DIFFUSE_SHADED
    Material mat = getPBRMaterial();
    vec3 color = computeLightContribution(mat, lightDir, lightColor);

    // Ambient Occlusion
    float ao = 1.0;
#if defined (HAS_TEXTURE_u_occlusionTexture) && defined(HAS_ATTRIBUTE_a_uv_2f)

#ifdef OCCLUSION_TEXTURE_TRANSFORM
    vec2 uv = uv_2f.xy * u_occlusionTextureTransform.zw + u_occlusionTextureTransform.xy;
#else
    vec2 uv = uv_2f;
#endif
    ao = (texture(u_occlusionTexture, uv).x - 1.0) * u_aoIntensity + 1.0;
    color *= ao;
#endif
    // Emission
    vec4 emissive = u_emissiveFactor;

#if defined(HAS_TEXTURE_u_emissionTexture) && defined(HAS_ATTRIBUTE_a_uv_2f)
    emissive.rgb *= sRGBToLinear(texture(u_emissionTexture, uv_2f).rgb);
#endif
    color += emissive.rgb;

    // Apply transparency
    float opacity = mat.baseColor.w * u_opacity;
#ifdef HAS_ATTRIBUTE_a_pbr
    float resEmission = v_roughness_metallic_emissive_alpha.z;

    resEmission *= v_height_based_emission_params.z + v_height_based_emission_params.w * pow(clamp(v_height_based_emission_params.x, 0.0, 1.0), v_height_based_emission_params.y);

    color = mix(color, v_color_mix.rgb, min(1.0, resEmission));
#ifdef HAS_ATTRIBUTE_a_color_4f
    // pbr includes color. If pbr is used, color_4f is used to pass information about light geometry.
    // calculate distance to line segment, multiplier 1.3 additionally deattenuates towards extruded corners.
    float distance = length(vec2(1.3 * max(0.0, abs(color_4f.x) - color_4f.z), color_4f.y));
    distance +=  mix(0.5, 0.0, clamp(resEmission - 1.0, 0.0, 1.0));
    opacity *= v_roughness_metallic_emissive_alpha.w * saturate(1.0 - distance * distance);
#endif
#endif
    // Use emissive strength as interpolation between lit and unlit color
    // for coherence with other layer types.
    vec3 unlitColor = mat.baseColor.rgb * ao + emissive.rgb;
    color = mix(color, unlitColor, u_emissive_strength);
    color = linearTosRGB(color);
    color *= opacity;
    finalColor = vec4(color, opacity);
#endif // !DIFFUSE_SHADED

#ifdef FOG
    finalColor = fog_dither(fog_apply_premultiplied(finalColor, v_fog_pos, v_position_height.w));
#endif

#ifdef RENDER_CUTOFF
    finalColor *= v_cutoff_opacity;
#endif

#ifdef INDICATOR_CUTOUT
    finalColor = applyCutout(finalColor);
#endif

    glFragColor = finalColor;

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
