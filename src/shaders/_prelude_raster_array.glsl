#ifdef RASTER_ARRAY
uniform sampler2D u_image0;
uniform sampler2D u_image1;

const vec4 NODATA = vec4(1);

// Decode raster array data and interpolate linearly using nearest neighbor samples
// Returns: vec2(value, nodata_alpha)
ivec4 _raTexLinearCoord(highp vec2 texCoord, highp vec2 texResolution, out highp vec2 fxy) {
    texCoord = texCoord * texResolution - 0.5;
    fxy = fract(texCoord);
    texCoord -= fxy;
    return ivec4(texCoord.xxyy + vec2(1.5, 0.5).xyxy);
}

vec2 _raTexLinearMix(highp vec2 fxy, highp vec4 colorMix, highp float colorOffset, highp vec4 t00, highp vec4 t10, highp vec4 t01, highp vec4 t11) {
    // Interpolate as a vec2: 1) the mixed value, and 2) a binary 0/1 mask.
    vec2 c00 = t00 == NODATA ? vec2(0) : vec2(colorOffset + dot(t00, colorMix), 1);
    vec2 c10 = t10 == NODATA ? vec2(0) : vec2(colorOffset + dot(t10, colorMix), 1);
    vec2 c01 = t01 == NODATA ? vec2(0) : vec2(colorOffset + dot(t01, colorMix), 1);
    vec2 c11 = t11 == NODATA ? vec2(0) : vec2(colorOffset + dot(t11, colorMix), 1);
    return mix(mix(c01, c11, fxy.x), mix(c00, c10, fxy.x), fxy.y);
}

// Decode raster array data and interpolate linearly using nearest neighbor samples
// Returns: vec2(value, nodata_alpha)
vec2 raTexture2D_image0_linear(highp vec2 texCoord, highp vec2 texResolution, highp vec4 colorMix, highp float colorOffset) {
    vec2 fxy;
    ivec4 c = _raTexLinearCoord(texCoord, texResolution, fxy);
    return _raTexLinearMix(fxy, colorMix, colorOffset,
         texelFetch(u_image0, c.yz, 0),
         texelFetch(u_image0, c.xz, 0),
         texelFetch(u_image0, c.yw, 0),
         texelFetch(u_image0, c.xw, 0)
    );
}
vec2 raTexture2D_image1_linear(highp vec2 texCoord, highp vec2 texResolution, highp vec4 colorMix, highp float colorOffset) {
    vec2 fxy;
    ivec4 c = _raTexLinearCoord(texCoord, texResolution, fxy);
    return _raTexLinearMix(fxy, colorMix, colorOffset,
         texelFetch(u_image1, c.yz, 0),
         texelFetch(u_image1, c.xz, 0),
         texelFetch(u_image1, c.yw, 0),
         texelFetch(u_image1, c.xw, 0)
    );
}

// Decode raster array data and return nearest neighbor sample
// Returns: vec2(value, nodata_alpha)
vec2 raTexture2D_image0_nearest(highp vec2 texCoord, highp vec2 texResolution, highp vec4 colorMix, highp float colorOffset) {
    vec4 t = texelFetch(u_image0, ivec2(texCoord * texResolution), 0);
    return t == NODATA ? vec2(0) : vec2(colorOffset + dot(t, colorMix), 1);
}
vec2 raTexture2D_image1_nearest(highp vec2 texCoord, highp vec2 texResolution, highp vec4 colorMix, highp float colorOffset) {
    vec4 t = texelFetch(u_image1, ivec2(texCoord * texResolution), 0);
    return t == NODATA ? vec2(0) : vec2(colorOffset + dot(t, colorMix), 1);
}

#endif
