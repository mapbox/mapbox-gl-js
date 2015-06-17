'use strict';

var shaders = require('./shaders');
var util = require('../util/util');

exports.extend = function(context) {
    var origLineWidth = context.lineWidth,
        lineWidthRange = context.getParameter(context.ALIASED_LINE_WIDTH_RANGE);

    context.lineWidth = function(width) {
        origLineWidth.call(context, util.clamp(width, lineWidthRange[0], lineWidthRange[1]));
    };

    context.getShader = function(name, type) {
        var kind = type === this.FRAGMENT_SHADER ? 'fragment' : 'vertex';
        if (!shaders[name] || !shaders[name][kind]) {
            throw new Error("Could not find shader " + name);
        }

        var shader = this.createShader(type);
        var shaderSource = shaders[name][kind];

        if (typeof orientation === 'undefined') {
            // only use highp precision on mobile browsers
            shaderSource = shaderSource.replace(/ highp /g, ' ');
        }

        this.shaderSource(shader, shaderSource);
        this.compileShader(shader);
        if (!this.getShaderParameter(shader, this.COMPILE_STATUS)) {
            throw new Error(this.getShaderInfoLog(shader));
        }
        return shader;
    };

    context.initializeShader = function(name, attributes, uniforms) {
        var shader = {
            program: this.createProgram(),
            fragment: this.getShader(name, this.FRAGMENT_SHADER),
            vertex: this.getShader(name, this.VERTEX_SHADER),
            attributes: []
        };
        this.attachShader(shader.program, shader.vertex);
        this.attachShader(shader.program, shader.fragment);

        // Disabling attrib location 0 causes weird behaviour. To avoid the problem, we assign
        // 'a_pos' to attrib location 0 making the assumptions that
        //
        //   - `a_pos` is never disabled
        //   - every shader has an `a_pos` attribute
        //
        // see: https://developer.mozilla.org/en-US/docs/Web/WebGL/WebGL_best_practices
        this.bindAttribLocation(shader.program, 0, 'a_pos');

        this.linkProgram(shader.program);

        if (!this.getProgramParameter(shader.program, this.LINK_STATUS)) {
            console.error(this.getProgramInfoLog(shader.program));
        } else {
            for (var i = 0; i < attributes.length; i++) {
                shader[attributes[i]] = this.getAttribLocation(shader.program, attributes[i]);
                shader.attributes.push(shader[attributes[i]]);
            }
            for (var k = 0; k < uniforms.length; k++) {
                shader[uniforms[k]] = this.getUniformLocation(shader.program, uniforms[k]);
            }
        }

        return shader;
    };

    // Switches to a different shader program.
    context.switchShader = function(shader, posMatrix, exMatrix) {
        if (!posMatrix) {
            console.trace('posMatrix does not have required argument');
        }

        if (this.currentShader !== shader) {
            this.useProgram(shader.program);

            // Disable all attribute arrays used by the previous shader and enable all the attribute
            // arrays used by the next shader. Ideally we would do a better job diffing these to
            // minimize operations (as we did in previously) but it is hard to keep track of state
            // in spaghetti shader boilerplate code and hard to debug when things go wrong.
            var previous = this.currentShader ? this.currentShader.attributes : [];
            for (var i = 0; i < previous.length; i++) {
                this.disableVertexAttribArray(previous[i]);
            }
            var next = shader.attributes;
            for (var j = 0; j < next.length; j++) {
                this.enableVertexAttribArray(next[j]);
            }

            this.currentShader = shader;
        }

        // Update the matrices if necessary. Note: This relies on object identity!
        // This means changing the matrix values without the actual matrix object
        // will FAIL to update the matrix properly.
        if (shader.posMatrix !== posMatrix) {
            this.uniformMatrix4fv(shader.u_matrix, false, posMatrix);
            shader.posMatrix = posMatrix;
        }
        if (exMatrix && shader.exMatrix !== exMatrix && shader.u_exmatrix) {
            this.uniformMatrix4fv(shader.u_exmatrix, false, exMatrix);
            shader.exMatrix = exMatrix;
        }
    };

    context.vertexAttrib2fv = function(attribute, values) {
        context.vertexAttrib2f(attribute, values[0], values[1]);
    };

    context.vertexAttrib3fv = function(attribute, values) {
        context.vertexAttrib3f(attribute, values[0], values[1], values[2]);
    };

    context.vertexAttrib4fv = function(attribute, values) {
        context.vertexAttrib4f(attribute, values[0], values[1], values[2], values[3]);
    };

    return context;
};
