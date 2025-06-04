// Position
in highp vec3 a_pos_3f;
// Offset from center ([-1, -1], ...)
in highp vec2 a_uv;

in highp vec4 a_rainParticleData;
// .x - random value
// .y - velocity scale multiplier
// .z - velocity cone angle pitch scale
// .w - velocity cone angle heading scale

// mvp
uniform mat4 u_modelview;
uniform mat4 u_projection;

// camera up & right vectors mulitplied by size
uniform vec3 u_cam_pos;

uniform float u_time;

uniform float u_boxSize;

uniform float u_velocityConeAperture; 

uniform float u_velocity; 

uniform vec2 u_rainDropletSize;

uniform vec3 u_rainDirection;


out highp vec2 uv;
out highp float particleRandomValue;

void main() {
    vec3 pos = a_pos_3f;

    float halfBoxSize = 0.5 * u_boxSize;

    pos *= halfBoxSize; 
    pos += u_cam_pos;

    //
    // Movement animation
    //

    // Cone angle
    float velocityConeApertureRad = radians(u_velocityConeAperture * 0.5);
    float coneAnglePichRad = velocityConeApertureRad * a_rainParticleData.z;

    float coneAngleHeadingRad = a_rainParticleData.w * radians(360.0);

    // vec3 direction = u_rainDirection;

    vec3 localZ = normalize(u_rainDirection);
    vec3 localX = normalize(cross(localZ, vec3(1, 0, 0)));
    vec3 localY = normalize(cross(localZ, localX));

    // Direction in local coordinate system
    vec3 directionLocal;
    directionLocal.x = cos(coneAngleHeadingRad) * sin(coneAnglePichRad);
    directionLocal.y = sin(coneAngleHeadingRad) * sin(coneAnglePichRad);
    directionLocal.z = cos(coneAnglePichRad);

    directionLocal = normalize(directionLocal);

    vec3 directionWorld = localX * directionLocal.x + localY * directionLocal.y + localZ * directionLocal.z;

    float velocityScale = (1.0 + 3.0 * a_rainParticleData.y) * u_velocity;

    vec3 simPosLocal = vec3(0, 0, 0);
    simPosLocal += directionLocal * velocityScale * u_time;

    vec3 simPos = localX * simPosLocal.x + 
                  localY * simPosLocal.y +
                  localZ * simPosLocal.z;

    pos += simPos;

    // Wrap against box around camera
    pos = fract((pos + vec3(halfBoxSize)) / vec3(u_boxSize)) * u_boxSize - vec3(halfBoxSize);

    vec4 posView = u_modelview * vec4(pos, 1.0);

    //
    // Billboarding
    //

    vec3 directionView = normalize((u_modelview * vec4(directionWorld, 0.0)).xyz);
    vec3 side = cross(directionView, normalize(posView.xyz));

    posView.xyz += side * a_uv.x * u_rainDropletSize.x;
    posView.xyz += directionView * a_uv.y * u_rainDropletSize.y;


    //
    // Pass attributes
    //

    uv = a_uv;
    particleRandomValue = a_rainParticleData.x;

    //
    // Projection
    //

    gl_Position = u_projection * posView;
}
