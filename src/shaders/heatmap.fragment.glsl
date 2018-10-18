#pragma mapbox: define highp float weight

uniform highp float u_intensity;
varying vec2 v_extrude;
varying vec2 v_pos;

// Gaussian kernel coefficient: 1 / sqrt(2 * PI)
#define GAUSS_COEF 0.3989422804014327
#define PI 3.141592653589793

#define HASHSCALE1 .1031
vec2 add = vec2(1.0, 0.0);

float Hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

float Noise( in vec2 x )
{
    vec2 p = floor(x);
    vec2 f = fract(x);
    f = f*f*(3.0-2.0*f);

    float res = mix(mix( Hash12(p),          Hash12(p + add.xy),f.x),
                    mix( Hash12(p + add.yx), Hash12(p + add.xx),f.x),f.y);
    return res;
}

float NoiseRound( in vec2 x )
{
    vec2 p = floor(x);
    vec2 f = floor(mod(10.0 * x, 10.0)) / 10.0;
    f = f*f*(3.0-2.0*f);

    float res = mix(mix( Hash12(p),          Hash12(p + add.xy),f.x),
                    mix( Hash12(p + add.yx), Hash12(p + add.xx),f.x),f.y);
    return res;
}


void main() {
    #pragma mapbox: initialize highp float weight

    // Kernel density estimation with a Gaussian kernel of size 5x5
    float d = -0.5 * 3.0 * 3.0 * dot(v_extrude, v_extrude);
    float val = weight * u_intensity * GAUSS_COEF * exp(d);
    float noise = (NoiseRound(20.0 * v_pos.xy) + 1.0) / 2.0;

    float distance = dot(v_extrude, v_extrude);
    highp float angle = (atan(v_extrude.x, v_extrude.y) / PI) + 0.1 * sin(distance) + Noise(v_pos.xy);
    highp float ridge = (abs(asin(mod(4.0 * angle, 2.0) - 1.0))/(PI/2.0) + 0.5) / 1.5;
    float ridgeAttenuation = 1.0 - max(0.0, 1.0 - 20.0 * distance);
    float attenuatedRidge = 1.0 - (1.0 - ridge) * ridgeAttenuation;

    // Add in attenuated ridge to get ridge/terrain effect
    gl_FragColor = vec4(attenuatedRidge * noise * val, 1.0, 1.0, 1.0);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
