function ImageSprite(style, callback) {

    this.retina = window.devicePixelRatio == 2;

    this.img = new Image();
    this.img.src = this.retina ? style.sprite_retina : style.sprite;
    this.img.onload = callback;

    // temporarily hardcoded
    this.position = {
            "embassy-12": {
                "x": 162 + 42,
                "y": 264,
                "width": 12,
                "height": 12
            },
            "park-12": {
                "x": 0 + 42,
                "y": 144,
                "width": 12,
                "height": 12
            },
            "restaurant-12": {
                "x": 0 + 42,
                "y": 288,
                "width": 12,
                "height": 12
            }
    };
}

ImageSprite.prototype.bind = function(gl) {
    if (this.texture) return;
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.img);
};

ImageSprite.prototype.getDimensions = function() {
    var x = this.retina ? 2 : 1;
    return [this.img.width/x, this.img.height/x];
};

ImageSprite.prototype.getPosition = function(name) {
    if (this.img.complete) {
        return this.position[name];
    }
}
