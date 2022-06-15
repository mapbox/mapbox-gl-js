let wind;

const windFiles = {
    0: '2016112000',
    6: '2016112006',
    12: '2016112012',
    18: '2016112018',
    24: '2016112100',
    30: '2016112106',
    36: '2016112112',
    42: '2016112118',
    48: '2016112200'
};

function getJSON(url, callback) {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'json';
    xhr.open('get', url, true);
    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            callback(xhr.response);
        } else {
            throw new Error(xhr.statusText);
        }
    };
    xhr.send();
}

function updateWind(name) {
    // TODO: move this file to webgl-wind once the API is released.
    getJSON('webgl-wind-dist/demo/wind/' + windFiles[name] + '.json', function (windData) {
        const windImage = new Image();
        windData.image = windImage;
        windImage.src = 'webgl-wind-dist/demo/wind/' + windFiles[name] + '.png';
        windImage.onload = function () {
            wind.setWind(windData, windImage);
            wind.resize();
        };
    });
}

var windLayer = {
    id: 'wind',
    type: 'custom',

    onAdd: (map, gl) => {
        wind = window.wind = new WindGL(gl, 4096, 4096);
        wind.numParticles = 65536;
        updateWind(0);
    },

    renderToTile: (gl, tileId) => {
        if (wind.windData) {
            // Our tile with wind is x=0, y=0, z=0 and there's need to calculate scale from our tile
            // to target tileId. If using projection matrix, ortho matrix calculation is available in
            // https://github.com/mapbox/mapbox-gl-js/blob/af9d108aac01354c8a94640ec0faaee27f26544b/src/terrain/terrain.js#L1353-L1354.
            // Here, the same is done, just scale and offset are not applied to ortho matrix but passed directly
            // to quad shader.
            const offsetScale = getOffsetAndScaleForTileMapping({x:0, y:0, z:0}, tileId);
            wind.drawTexture(wind.screenTexture, 0.8, offsetScale);
        }
    },

    shouldRerenderTiles: () => {
        // return true only for frame when content has changed - otherwise, all the terrain
        // render cache would be invalidated and redrawn causing huge drop in performance.
        return true;
    },

    prerender: (gl, matrix) => {
        // offscreen pass, rendering to globe particle textures
        prerender();
    },

    render: (gl, matrix) => {
        // this codepath is for debugging only, not used in terrain and globe demo
        prerender();
        render();
    }
};


function getOffsetAndScaleForTileMapping(windTile, targetTile) {
    const zoomDiff = targetTile.z - windTile.z;
    // const wrap = (tile.tileID.wrap - proxyTileID.wrap) << proxyTileID.overscaledZ;
    if (zoomDiff < 0) {
        console.warn("Implementation here assumes that wind rasters are of lower or equal zoom than the terrain drape tiles.")
    }
    const scale = 1 << zoomDiff;
    const tileX = (targetTile.x % (1 << targetTile.z) + (1 << targetTile.z)) % (1 << targetTile.z); // don't care here about wrap, render the same to all world copies
    const xTileOffset = ((windTile.x << zoomDiff) - tileX) / (1 << targetTile.z); // UV wrap offset is 0..1 for the quad.
    const yTileOffset = ((windTile.y << zoomDiff) - targetTile.y) / (1 << targetTile.z); // UV wrap offset is 0..1 for the quad.
    return [xTileOffset, yTileOffset, scale, scale];
}

// copied from webgl-wind/src/index.js
function bindTexture(gl, texture, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
}

// copied from webgl-wind/src/index.js
function bindFramebuffer(gl, framebuffer, texture) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    if (texture) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }
}

function prerender() {
    var gl = wind.gl;

    gl.disable(gl.BLEND);

    // save the current screen as the background for the next frame
    var temp = wind.backgroundTexture;
    wind.backgroundTexture = wind.screenTexture;
    wind.screenTexture = temp;

    bindTexture(gl, wind.windTexture, 0);
    bindTexture(gl, wind.particleStateTexture0, 1);

    wind.updateParticles();

    gl.disable(gl.BLEND);

    bindTexture(gl, wind.windTexture, 0);
    bindTexture(gl, wind.particleStateTexture0, 1);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);

    // draw the screen into a temporary framebuffer to retain it as the background on the next frame
    bindFramebuffer(gl, wind.framebuffer, wind.screenTexture);
    gl.viewport(0, 0, wind.texWidth(), wind.texHeight());

    wind.drawTexture(wind.backgroundTexture, wind.fadeOpacity);
    wind.drawParticles();

    // TODO wind.updateParticles() and split swap of textures to render()
}

function render() {
    // Not used in terrain demo
    var gl = wind.gl;

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);

    // Wind drawScreen:
    bindFramebuffer(gl, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // enable blending to support drawing on top of an existing background (e.g. a map)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    wind.drawTexture(wind.screenTexture, 1.0);
    gl.disable(gl.BLEND);

}
