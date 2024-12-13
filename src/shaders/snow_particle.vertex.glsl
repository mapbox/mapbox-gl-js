// Position
in highp vec3 a_pos_3f;
// Offset from center ([-1, -1], ...)
in highp vec2 a_uv;

in highp vec4 a_snowParticleData;
// .x - relative index [0, 1]
// .y - velocity scale multiplier
// .z - velocity cone angle scale
// .w - velocity cone pitch scale

in highp vec4 a_snowParticleDataHorizontalOscillation;
// .x - radius scale
// .y - velocity scale

// mvp
uniform mat4 u_modelview;
uniform mat4 u_projection;

uniform vec3 u_cam_pos;

uniform vec2 u_screenSize;

uniform float u_time;

uniform float u_boxSize;

uniform float u_velocityConeAperture; 

uniform float u_velocity; 

// Main direction
uniform vec3 u_direction;


uniform float u_horizontalOscillationRadius; 
uniform float u_horizontalOscillationRate; 

uniform float u_billboardSize;

// Thinning 
uniform vec2 u_thinningCenterPos;
uniform vec3 u_thinningShape;
// .x - start
// .y - range
// .z - fade power

// Ratio of particles subject to thinning
uniform float u_thinningAffectedRatio;

// Particle-based thinning shape offset
// Needed in order to make thinning shape less uniform
uniform float u_thinningParticleOffset;

out highp vec2 uv;
out highp float alphaMultiplier;

void main() {
    vec3 pos = a_pos_3f;

    float halfBoxSize = 0.5 * u_boxSize;

    pos.xyz *= halfBoxSize;

    pos += u_cam_pos;

    //
    // Movement animation
    //

    // Cone angle
    float velocityConeApertureRad = radians(u_velocityConeAperture * 0.5);
    float coneAnglePichRad = velocityConeApertureRad * a_snowParticleData.z;

    float coneAngleHeadingRad = a_snowParticleData.w * radians(360.0);

    vec3 localZ = normalize(u_direction);
    vec3 localX = normalize(cross(localZ, vec3(1, 0, 0)));
    vec3 localY = normalize(cross(localZ, localX));

    // Direction in local coordinate system
    vec3 direction;
    direction.x = cos(coneAngleHeadingRad) * sin(coneAnglePichRad);
    direction.y = sin(coneAngleHeadingRad) * sin(coneAnglePichRad);
    direction.z = cos(coneAnglePichRad);

    direction = normalize(direction);

    vec3 simPosLocal = vec3(0, 0, 0);

    float velocityScale = (1.0 + 3.0 * a_snowParticleData.y) * u_velocity;
    simPosLocal += direction * velocityScale * u_time;

    // Horizontal oscillation
    float horizontalOscillationRadius = u_horizontalOscillationRadius * a_snowParticleDataHorizontalOscillation.x;
    float horizontalOscillationAngle = u_horizontalOscillationRate * u_time * (-1.0 + 2.0 * a_snowParticleDataHorizontalOscillation.y);
    simPosLocal.xy += horizontalOscillationRadius * vec2(cos(horizontalOscillationAngle), sin(horizontalOscillationAngle));

    vec3 simPos = localX * simPosLocal.x + 
                  localY * simPosLocal.y +
                  localZ * simPosLocal.z;

    pos += simPos;


    // Wrap against box around camera

    pos = fract((pos + vec3(halfBoxSize)) / vec3(u_boxSize)) * u_boxSize - vec3(halfBoxSize);

    float clipZ = -u_cam_pos.z + pos.z;

    vec4 posView = u_modelview * vec4(pos, 1.0);

    //
    // Billboarding
    //

    float size = u_billboardSize;

    alphaMultiplier = 1.0;

    vec4 posScreen = u_projection * posView;
    posScreen /= posScreen.w;
    posScreen.xy = vec2(0.5) + posScreen.xy * 0.5;
    posScreen.xy *= u_screenSize;

    vec2 thinningCenterPos = u_thinningCenterPos.xy;
    thinningCenterPos.y = u_screenSize.y - thinningCenterPos.y;

    float screenDist = length((thinningCenterPos - posScreen.xy) / (0.5 * u_screenSize));
    screenDist += a_snowParticleData.x * u_thinningParticleOffset;
    float scaleFactorMode = 0.0;
    float thinningShapeDist = u_thinningShape.x + u_thinningShape.y;
    if (screenDist < thinningShapeDist) {
        float thinningFadeRatio = clamp((screenDist - u_thinningShape.x) / u_thinningShape.y, 0.0, 1.0);
        thinningFadeRatio = pow(thinningFadeRatio, u_thinningShape.z);
        if (a_snowParticleData.x < u_thinningAffectedRatio) {
            scaleFactorMode = 1.0 - thinningFadeRatio;
            alphaMultiplier = thinningFadeRatio;
        }
    }

    vec4 posScreen1 = u_projection * vec4(posView.x - size, posView.yzw);
    posScreen1 /= posScreen1.w;

    vec4 posScreen2 = u_projection * vec4(posView.x + size, posView.yzw);
    posScreen2 /= posScreen2.w;


    posScreen1.xy = vec2(0.5) + posScreen1.xy * 0.5;
    posScreen1.xy *= u_screenSize;
    posScreen2.xy = vec2(0.5) + posScreen2.xy * 0.5;
    posScreen2.xy *= u_screenSize;

    float screenLength = length(posScreen1.xy - posScreen2.xy);

    // Min size restriction in pixels
    float screenEpsilon = 3.0;
    float scaleFactor = 1.0;
    if (screenLength < screenEpsilon) {
        scaleFactor = screenEpsilon / max(screenLength, 0.01);
        scaleFactor = mix(scaleFactor, 1.0, scaleFactorMode);
    }

    // Max size restriction in pixels
    float screenEpsilon2 = 15.0;
    if (screenLength > screenEpsilon2) {
        scaleFactor = screenEpsilon2 / max(screenLength, 0.01);
    }

    size *= scaleFactor;

    vec2 right = size * vec2(1, 0);
    vec2 up = size * vec2(0, 1);

    posView.xy += right * a_uv.x;
    posView.xy += up * a_uv.y;

    //
    // Pass attributes
    //

    uv = a_uv;

    //
    // Projection
    //

    gl_Position = u_projection * posView;
}
