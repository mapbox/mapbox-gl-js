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
        this.shaderSource(shader, shaders[name][kind]);
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
    context.switchShader = function(shader) {

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
    };

    return context;
};
