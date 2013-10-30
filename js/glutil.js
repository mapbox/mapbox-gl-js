var shaders = require('./shaders.js');

if (WebGLRenderingContext) {
    WebGLRenderingContext.prototype.getShader = function(name, type) {
        var kind = type == this.FRAGMENT_SHADER ? 'fragment' : 'vertex';
        if (!shaders[name] || !shaders[name][kind]) {
            throw new Error("Could not find shader " + name);
        }

        var shader = this.createShader(type);
        this.shaderSource(shader, shaders[name][kind]);
        this.compileShader(shader);
        if (!this.getShaderParameter(shader, this.COMPILE_STATUS)) {
            throw new Error(this.getShaderInfoLog(shader));
        }
        return shader;
    };

    WebGLRenderingContext.prototype.initializeShader = function(name, attributes, uniforms) {
        var shader = {
            program: this.createProgram(),
            fragment: this.getShader(name, this.FRAGMENT_SHADER),
            vertex: this.getShader(name, this.VERTEX_SHADER),
            attributes: []
        };
        this.attachShader(shader.program, shader.vertex);
        this.attachShader(shader.program, shader.fragment);
        this.linkProgram(shader.program);

        if (!this.getProgramParameter(shader.program, this.LINK_STATUS)) {
            console.error(this.getProgramInfoLog(shader.program));
            alert("Could not initialize shader " + name);
        } else {
            for (var i = 0; i < attributes.length; i++) {
                shader[attributes[i]] = this.getAttribLocation(shader.program, attributes[i]);
                shader.attributes.push(shader[attributes[i]]);
            }
            for (var i = 0; i < uniforms.length; i++) {
                shader[uniforms[i]] = this.getUniformLocation(shader.program, uniforms[i]);
            }
        }

        return shader;
    };

    // Switches to a different shader program.
    WebGLRenderingContext.prototype.switchShader = function(shader, posMatrix, exMatrix) {
        if (!exMatrix || !posMatrix) {
            console.trace('exMatrix/posMatrix does not have required argument');
        }

        if (this.currentShader !== shader) {
            this.useProgram(shader.program);

            // Disable all attributes from the existing shader that aren't used in
            // the new shader. Note: attribute indices are *not* program specific!
            var enabled = this.currentShader ? this.currentShader.attributes : [];
            var required = shader.attributes;

            for (var i = 0; i < enabled.length; i++) {
                if (required.indexOf(enabled[i]) < 0) {
                    this.disableVertexAttribArray(enabled[i]);
                }
            }

            // Enable all attributes for the new shader.
            for (var j = 0; j < required.length; j++) {
                if (enabled.indexOf(required[j]) < 0) {
                    this.enableVertexAttribArray(required[j]);
                }
            }

            this.currentShader = shader;
        }

        // Update the matrices if necessary. Note: This relies on object identity!
        // This means changing the matrix values without the actual matrix object
        // will FAIL to update the matrix properly.
        if (shader.posMatrix !== posMatrix) {
            this.uniformMatrix4fv(shader.u_posmatrix, false, posMatrix);
            shader.posMatrix = posMatrix;
        }
        if (exMatrix && shader.exMatrix !== exMatrix && shader.u_exmatrix) {
            this.uniformMatrix4fv(shader.u_exmatrix, false, exMatrix);
            shader.exMatrix = exMatrix;
        }
    };
}
