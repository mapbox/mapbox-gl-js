
if (WebGLRenderingContext) {
    if (!WebGLRenderingContext.prototype.getShader) {
        WebGLRenderingContext.prototype.getShader = function(id) {
            var script = document.getElementById(id);
            switch (script && script.type) {
                case 'x-shader/x-fragment': var shader = this.createShader(this.FRAGMENT_SHADER); break;
                case 'x-shader/x-vertex':   var shader = this.createShader(this.VERTEX_SHADER); break;
                default: return null;
            }

            this.shaderSource(shader, script.innerText || script.text);
            this.compileShader(shader);
            if (!this.getShaderParameter(shader, this.COMPILE_STATUS)) {
                console.error(this.getShaderInfoLog(shader));
                return null;
            } else {
                return shader;
            }
        };
    }
}
