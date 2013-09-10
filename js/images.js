// image url -> texture

function Images() {
    this.images = {};
}

Images.prototype.texture  = function(gl, url) {
    if (this.images[url] && this.images[url].texture) {
        return this.images[url];

    } else {

        var image = this.images[url] = this.images[url] || {};

        if (!image.img) {
            image.img = new Image();
            image.img.src = url;

            image.img.onload = function() {
                image.texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, image.texture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image.img);

                // todo request map redraw
            }
        }
    }
}

