    uniform vec2 u_center;
uniform float u_radius;
uniform vec2 u_screen_size;

uniform float u_opacity;
uniform highp float u_fadeout_range;
uniform vec3 u_start_color;
uniform vec3 u_end_color;
uniform float u_pixel_ratio;

uniform highp vec3 u_globe_center;
uniform highp vec3 u_camera_pos;
uniform highp vec3 u_camera_dir;
uniform highp float u_radius2;
uniform highp vec3 u_light_dir;

varying vec3 viewVector;

const float Kr = 0.0025;                    // Rayleigh scattering constant
const float Kr4PI = Kr * 4.0 * PI;
const float Km = 0.0015;                    // Mie scattering constant
const float Km4PI = Km * 4.0 * PI;
const float ESun = 15.0;                    // brightness of the sun
const float KmESun = Km * ESun;
const float KrESun = Kr * ESun;
const float g = -0.99;                      // Valid range suggested to be [-0.75, -0.999
const float g2 = g * g;
const vec3 invWaveLength = vec3(5.60204474633, 9.47328443792, 19.6438026105);   // vec3(1.0) / pow(vec3(0.65, 0.57, 0.475), 4.0);


// Returns (tNear, tFar, bool intersection)
vec3 raySphereIntersection(vec3 rayPos, vec3 rayDir, vec3 spherePos, float radius) {
    vec3 m = rayPos - spherePos;
    float b = dot(m, rayDir);
    float c = dot(m, m) - radius * radius;

    float discr = b * b - c;

    float discrRoot = sqrt(max(discr, 0.0));
    return vec3(-b - discrRoot, -b + discrRoot, discr >= 0.0);
}

// Computes optical depth starting from the provided depth towards a specified angle
// (on a perfect sphere). This is approximation as presented by Sean O'Neil in GPU Gems 2.
//
// The idea is to find a numerical representation for the optical depth lookup function f(x, y)
// where x is normalized height of the sample point in the atmosphere and y is vertical angle
// towards the light source, ie. sun. O'Neil presented that optical depth integral from sun to point P
// anywhere in the atmosphere can be simulated with a function f(x,y) = exp(-4 * x) * g(cos(y))
// where g(y) is a best fit polynomial curve. Following g(y) can be used only in scenarios where average
// density of the atmosphere is found at height 0.25 and where thickness of the atmosphere is 1.025 times
// the planet radius.

float scale(float cosAngle) {
    float x = 1.0 - cosAngle;
    return 0.25 * exp(-0.00287 + x*(0.459 + x*(3.83 + x*(-6.80 + x*5.25))));
}

float density(float height) {
    float atmosphereHeight = 0.025 * u_radius2;
    return exp(-4.0 * height / atmosphereHeight);
}

float opticalDepth(float height, float cosAngle) {
    return density(height) * scale(cosAngle);
}

void main() {
    vec3 dir = normalize(viewVector);
    vec3 distanceToAtmosphere = raySphereIntersection(u_camera_pos, dir, u_globe_center, u_radius2 * 1.025);

    // Not intersecting the atmosphere
    if (distanceToAtmosphere.z == 0.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec3 distanceToSurface = raySphereIntersection(u_camera_pos, dir, u_globe_center, u_radius2);
    
    const int samples = 2;

    // Two different cases depending on whether the ray hits the ground
    if (distanceToSurface.z == 0.0) {
        // Find travel distance of the ray in the atmosphere
        float distanceToImpact = max(distanceToAtmosphere.x, 0.0);
        float travelDistance = distanceToAtmosphere.y - distanceToImpact;

        // Compute optical depth from the camera point towards the ray exit location on the atmosphere.
        // This can be used to find optical depth of the segment from camera to any sample point:
        // opticalDepth(entHeight, entAngleCos) - opticalDepth(height_b, angleCos_b)
        vec3 pointOfEnterance = u_camera_pos + dir * distanceToImpact;
        float entHeight = length(pointOfEnterance - u_globe_center);
        float entAngleCos = dot(dir, pointOfEnterance - u_globe_center) / entHeight;
        float entOptDepth = opticalDepth(entHeight - u_radius2, entAngleCos);

        // Accumulate in-scattered light with few integration steps
        float stepLen = travelDistance / float(samples);
        float scaledStepLen = stepLen / (0.025 * u_radius2);
        vec3 sampleRay = dir * stepLen;
        vec3 samplePoint = pointOfEnterance + sampleRay * 0.5;

        vec3 color = vec3(0.0, 0.0, 0.0);

        for (int i = 0; i < samples; i++) {
            float sampleHeight = length(samplePoint - u_globe_center);
            float sampleDensity = density(sampleHeight - u_radius2);
            float lightAngleCos = dot(u_light_dir, samplePoint - u_globe_center) / sampleHeight;
            float cameraAngleCos = dot(dir, samplePoint - u_globe_center) / sampleHeight;

            // Light rays from the sun needs to travel first through the atmosphere to the sample point
            // and then from sample point to the camera 
            float totalOpticalDepth = entOptDepth - opticalDepth(sampleHeight - u_radius2, cameraAngleCos) + opticalDepth(sampleHeight - u_radius2, lightAngleCos);
            vec3 transmittance = exp(-totalOpticalDepth * (invWaveLength * Kr4PI + Km4PI));
            color += transmittance * (sampleDensity * scaledStepLen);

            samplePoint += sampleRay;
        }

        vec3 mieColor = color * KmESun;
        vec3 rayleighColor = color * (invWaveLength * KrESun);

        float fCos = dot(u_light_dir, -dir);
        float fMiePhase = 1.5 * ((1.0 - g2) / (2.0 + g2)) * (1.0 + fCos*fCos) / pow(1.0 + g2 - 2.0*g*fCos, 1.5);

        gl_FragColor.rgb = rayleighColor + fMiePhase * mieColor;
        gl_FragColor.a = 1.0;

        // exposure
        gl_FragColor.rgb = vec3(1.0) - exp(gl_FragColor.rgb * -1.5);
    } else {
        // Find travel distance of the ray in the atmosphere
        float distanceToImpact = max(distanceToAtmosphere.x, 0.0);
        float travelDistance = distanceToSurface.x - distanceToImpact;

        vec3 pointOfEnterance = u_camera_pos + dir * distanceToImpact;
        float entHeight = length(pointOfEnterance - u_globe_center);
        float entAngleCos = dot(-dir, pointOfEnterance - u_globe_center) / entHeight;       // note the negated angle
        float entOptDepth = opticalDepth(entHeight - u_radius2, entAngleCos);

        // Accumulate in-scattered light with few integration steps
        float stepLen = travelDistance / float(samples);
        float scaledStepLen = stepLen / (0.025 * u_radius2);
        vec3 sampleRay = dir * stepLen;
        vec3 samplePoint = pointOfEnterance + sampleRay * 0.5;

        vec3 color = vec3(0.0, 0.0, 0.0);
        vec3 transmittance = vec3(0.0, 0.0, 0.0);

        for (int i = 0; i < samples; i++) {
            float sampleHeight = length(samplePoint - u_globe_center);
            float sampleDensity = density(sampleHeight - u_radius2);

            // NOTE: example implementation reuses same angle cosines for both angles at every sample position
            // angle is computed once at the location on the globe's surface
            float lightAngleCos = dot(u_light_dir, samplePoint - u_globe_center) / sampleHeight;
            float cameraAngleCos = dot(-dir, samplePoint - u_globe_center) / sampleHeight;
            float totalOpticalDepth = opticalDepth(sampleHeight - u_radius2, cameraAngleCos) - entOptDepth + opticalDepth(sampleHeight - u_radius2, lightAngleCos);
            transmittance = exp(-totalOpticalDepth * (invWaveLength * Kr4PI + Km4PI));
            color += transmittance * sampleDensity * scaledStepLen;

            samplePoint += sampleRay;
        }

        gl_FragColor.rgb = color * (KmESun + invWaveLength * KrESun);
        //gl_FragColor.rgb = vec3(1.0) - exp(gl_FragColor.rgb * -1.5);
        gl_FragColor.a = transmittance.b;

        //gl_FragColor = vec4(0.0, 0.0, 0.0, 0.3);
    }
}