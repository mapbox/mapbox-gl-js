// @flow

import window from './window';
import browser from './browser';

let glForTesting;
let webpCheckComplete = false;
let webpImgTest;

if (window.document) {
    webpImgTest = window.document.createElement('img');
    webpImgTest.onload = function() {
        if (glForTesting) testWebpTextureUpload(glForTesting);
        glForTesting = null;
    };
    webpImgTest.onerror = function() {
        webpCheckComplete = true;
        glForTesting = null;
    };
    webpImgTest.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAQAAAAfQ//73v/+BiOh/AAA=';
}

export default testWebp;

function testWebp(gl: WebGLRenderingContext) {
    if (webpCheckComplete || !webpImgTest) return;

    if (!webpImgTest.complete) {
        glForTesting = gl;
        return;
    }

    testWebpTextureUpload(gl);
}

function testWebpTextureUpload(gl: WebGLRenderingContext) {
    // Edge 18 supports WebP but not uploading a WebP image to a gl texture
    // Test support for this before allowing WebP images.
    // https://github.com/mapbox/mapbox-gl-js/issues/7671
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, webpImgTest);
        browser.supportsWebp = true;
    } catch (e) {
        // Catch "Unspecified Error." in Edge 18.
    }

    gl.deleteTexture(texture);

    webpCheckComplete = true;
}
