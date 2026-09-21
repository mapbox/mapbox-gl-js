/// Maximum size of UBO (uniform buffer object).
///
/// Specs guarantees a minimum of 16KB, but some devices support larger UBOs,
/// and this value can be set at runtime based on device capabilities.
#ifndef MAX_UBO_SIZE_VEC4
#define MAX_UBO_SIZE_VEC4 1024u
#endif

/// Zoom-interpolation factor from a property's stored [zm, zM] range. Clamped to [0, 1]: unlike
/// the old per-frame floor(renderZoom) fraction, zoomFraction is now the offset from the
/// bucket's own (fixed) floor zoom, so it isn't bounded to [0, 1) by construction — a tile can
/// keep rendering many zoom levels away from where its bucket was built (overscaling).
float zoomFactor(float zm, float zM, float zoomFraction) {
    if (zm == zM) return zoomFraction - zm >= 0.0 ? 1.0 : 0.0;
    return clamp((zoomFraction - zm) / (zM - zm), 0.0, 1.0);
}
