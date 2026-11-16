in highp vec2 uv;
in highp float particleRandomValue;

uniform sampler2D u_texScreen;
uniform vec2 u_screenSize;

uniform float u_distortionStrength;

uniform vec4 u_color;

// Thinning
uniform vec2 u_thinningCenterPos;
uniform vec3 u_thinningShape;
// .x - start
// .y - range
// .z - fade power
uniform float u_thinningAffectedRatio;
uniform float u_thinningParticleOffset;

uniform float u_shapeDirectionalPower;

uniform float u_mode;
// 0 - distortion only
// 1 - alpha blend only

void main() {
    vec2 st = uv * 0.5 + vec2(0.5);


    vec2 uvm = uv;
    uvm.y = -1.0 + 2.0 * pow(st.y, u_shapeDirectionalPower);

    float shape = clamp(1.0 - length(uvm), 0.0, 1.0);

    float alpha = abs(shape) * u_color.a;

    vec2 deltaScreen = fragcoord_to_bottom_left_uv(u_thinningCenterPos, u_screenSize) - fragcoord_to_bottom_left_uv(gl_FragCoord.xy, u_screenSize);

    float screenDist = 2.0 * length(deltaScreen);
    screenDist += (0.5 + 0.5 * particleRandomValue) * u_thinningParticleOffset;

    float thinningShapeDist = u_thinningShape.x + u_thinningShape.y;
    float thinningAlpha = 1.0;
    if (screenDist < thinningShapeDist) {
        float thinningFadeRatio = clamp((screenDist - u_thinningShape.x) / u_thinningShape.y, 0.0, 1.0);
        thinningFadeRatio = pow(thinningFadeRatio, u_thinningShape.z);
        thinningAlpha *= thinningFadeRatio;
    }

    vec2 offsetXY = normalize(uvm) * abs(shape);
    vec2 stScreen = fragcoord_to_bottom_left_uv(gl_FragCoord.xy + offsetXY * u_distortionStrength * thinningAlpha, u_screenSize);
    vec3 colorScreen = texture(u_texScreen, stScreen).rgb;

    alpha *= thinningAlpha;

    glFragColor = mix(vec4(colorScreen, 1.0), vec4(u_color.rgb * alpha, alpha), u_mode);

    HANDLE_WIREFRAME_DEBUG;
}
