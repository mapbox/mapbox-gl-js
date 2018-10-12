#pragma mapbox: define highp float weight

uniform highp float u_intensity;
varying vec2 v_extrude;

// Gaussian kernel coefficient: 1 / sqrt(2 * PI)
#define GAUSS_COEF 0.3989422804014327

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


void main() {
    #pragma mapbox: initialize highp float weight

    // Kernel density estimation with a Gaussian kernel of size 5x5
    float d = -0.5 * 3.0 * 3.0 * dot(v_extrude, v_extrude);
    float val = weight * u_intensity * GAUSS_COEF * exp(d);
    float noise = (Noise(gl_FragCoord.xy) + 2.0) / 3.0;
    //(abs(sin(dot(v_extrude, v_extrude)/100.0 * atan(v_extrude.x, v_extrude.y))) + 2.0) / 3.0;

    gl_FragColor = vec4(noise * val, 1.0, 1.0, 1.0);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
