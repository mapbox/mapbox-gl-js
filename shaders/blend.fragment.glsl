precision mediump float;

uniform sampler2D u_image0;
uniform sampler2D u_image1;

varying vec2 v_pos;

/*
** Adapted from http://mouaif.wordpress.com/2009/01/05/photoshop-math-with-glsl-shaders/
**
** Copyright (c) 2012, Romain Dura romain@shazbits.com
** 
** Permission to use, copy, modify, and/or distribute this software for any 
** purpose with or without fee is hereby granted, provided that the above 
** copyright notice and this permission notice appear in all copies.
** 
** THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES 
** WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF 
** MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY 
** SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES 
** WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN 
** ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR 
** IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/

#define BlendLinearDodgef           BlendAddf
#define BlendLinearBurnf            BlendSubstractf
#define BlendAddf(base, blend)      min(base + blend, 1.0)
#define BlendSubstractf(base, blend)    max(base + blend - 1.0, 0.0)
#define BlendLightenf(base, blend)      max(blend, base)
#define BlendDarkenf(base, blend)       min(blend, base)
#define BlendLinearLightf(base, blend)  (blend < 0.5 ? BlendLinearBurnf(base, (2.0 * blend)) : BlendLinearDodgef(base, (2.0 * (blend - 0.5))))
#define BlendScreenf(base, blend)       (1.0 - ((1.0 - base) * (1.0 - blend)))
#define BlendOverlayf(base, blend)  (base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend)))
#define BlendSoftLightf(base, blend)    ((blend < 0.5) ? (2.0 * base * blend + base * base * (1.0 - 2.0 * blend)) : (sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend)))
#define BlendColorDodgef(base, blend)   ((blend == 1.0) ? blend : min(base / (1.0 - blend), 1.0))
#define BlendColorBurnf(base, blend)    ((blend == 0.0) ? blend : max((1.0 - ((1.0 - base) / blend)), 0.0))
#define BlendVividLightf(base, blend)   ((blend < 0.5) ? BlendColorBurnf(base, (2.0 * blend)) : BlendColorDodgef(base, (2.0 * (blend - 0.5))))
#define BlendPinLightf(base, blend)     ((blend < 0.5) ? BlendDarkenf(base, (2.0 * blend)) : BlendLightenf(base, (2.0 *(blend - 0.5))))
#define BlendHardMixf(base, blend)  ((BlendVividLightf(base, blend) < 0.5) ? 0.0 : 1.0)
#define BlendReflectf(base, blend)      ((blend == 1.0) ? blend : min(base * base / (1.0 - blend), 1.0))

/*
** Vector3 blending modes
*/

// Component wise blending
#define Blend(base, blend, funcf)       vec3(funcf(base.r, blend.r), funcf(base.g, blend.g), funcf(base.b, blend.b))

#define BlendNormal(base, blend)        (blend)
#define BlendLighten                BlendLightenf
#define BlendDarken             BlendDarkenf
#define BlendMultiply(base, blend)      (base * blend)
#define BlendAverage(base, blend)       ((base + blend) / 2.0)
#define BlendAdd(base, blend)       min(base + blend, vec3(1.0))
#define BlendSubstract(base, blend)     max(base + blend - vec3(1.0), vec3(0.0))
#define BlendDifference(base, blend)    abs(base - blend)
#define BlendNegation(base, blend)  (vec3(1.0) - abs(vec3(1.0) - base - blend))
#define BlendExclusion(base, blend)     (base + blend - 2.0 * base * blend)
#define BlendScreen(base, blend)        Blend(base, blend, BlendScreenf)
#define BlendOverlay(base, blend)       Blend(base, blend, BlendOverlayf)
#define BlendSoftLight(base, blend)     Blend(base, blend, BlendSoftLightf)
#define BlendHardLight(base, blend)     BlendOverlay(blend, base)
#define BlendColorDodge(base, blend)    Blend(base, blend, BlendColorDodgef)
#define BlendColorBurn(base, blend)     Blend(base, blend, BlendColorBurnf)
#define BlendLinearDodge            BlendAdd
#define BlendLinearBurn         BlendSubstract
// Linear Light is another contrast-increasing mode
// If the blend color is darker than midgray, Linear Light darkens the image by decreasing the brightness. If the blend color is lighter than midgray, the result is a brighter image due to increased brightness.
#define BlendLinearLight(base, blend)   Blend(base, blend, BlendLinearLightf)
#define BlendVividLight(base, blend)    Blend(base, blend, BlendVividLightf)
#define BlendPinLight(base, blend)      Blend(base, blend, BlendPinLightf)
#define BlendHardMix(base, blend)       Blend(base, blend, BlendHardMixf)
#define BlendReflect(base, blend)       Blend(base, blend, BlendReflectf)
#define BlendGlow(base, blend)      BlendReflect(blend, base)
#define BlendPhoenix(base, blend)       (min(base, blend) - max(base, blend) + vec3(1.0))
#define BlendOpacity(base, blend, F, O)     (F(base, blend) * O + blend * (1.0 - O))

#ifndef BLEND
#define BLEND BlendNormal
#endif

void main() {
    vec4 color0 = texture2D(u_image0, v_pos);
    vec4 color1 = texture2D(u_image1, v_pos);

    // unpremultiply
    color0.rgb = min(color0.rgb / color0.a, 1.0);
    color1.rgb = min(color1.rgb / color1.a, 1.0);

    vec3 blended = BLEND(color0.rgb, color1.rgb);

    // if the overlay is not opaque, mix the blended color with the base
    vec3 mixed = mix(color0.rgb, blended, color1.a);

    gl_FragColor = vec4(mixed, 1.0) * color0.a;
}
