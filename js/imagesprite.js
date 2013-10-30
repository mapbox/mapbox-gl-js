module.exports = ImageSprite;
function ImageSprite(style, callback) {

    this.style = style;
    this.imageloadCallback = callback;

    this.loadImage(callback);

    var imagesprite = this;
    var xhr = new XMLHttpRequest();
    xhr.open("GET", this.style.sprite.positions, true);
    xhr.onload = function(e) {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
            imagesprite.position = JSON.parse(xhr.response);
            if (imagesprite.img.complete) callback();
        }
    };
    xhr.send();

}

ImageSprite.prototype.loadImage = function(callback) {
    this.retina = window.devicePixelRatio > 1;

    var imagesprite = this;

    this.img = new Image();
    this.img.src = this.retina ? this.style.sprite.retina : this.style.sprite.image;
    this.img.onload = function() {

        var pixelRatio = imagesprite.retina ? 2 : 1;
        imagesprite.dimensions = {
            x: imagesprite.img.width / pixelRatio,
            y: imagesprite.img.height / pixelRatio
        };

        if (imagesprite.position) callback();
    };

};

ImageSprite.prototype.resize = function(gl) {
    if (window.devicePixelRatio > 1 !== this.retina) {

        var imagesprite = this;

        this.loadImage(function() {
            if (imagesprite.texture) {
                gl.deleteTexture(imagesprite.texture);
                delete imagesprite.texture;
            }

            imagesprite.imageloadCallback();
        });
    }
};

ImageSprite.prototype.bind = function(gl, linear) {
    if (!this.texture) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.img);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }

    var filter = linear ? gl.LINEAR : gl.NEAREST;

    if (filter !== this.filter) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    }
};

ImageSprite.prototype.getPosition = function(name) {
    var pos = this.position && this.position[name];
    if ((this.dimensions || this.texture) && pos) {

        return {
            size: [pos.width * window.devicePixelRatio, pos.height * window.devicePixelRatio],
            tl: [pos.x / this.dimensions.x, pos.y / this.dimensions.y],
            br: [(pos.x + pos.width) / this.dimensions.x, (pos.y + pos.height) / this.dimensions.y]
        };
    }
};
