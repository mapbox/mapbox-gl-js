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
