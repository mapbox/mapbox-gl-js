'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var util = require('../../util/util');

// readFileSync calls must be written out long-form for brfs.
var definitions = {
    debug: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/debug.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/debug.vertex.glsl'), 'utf8'),
        attributeNames: ['a_pos'],
        uniformNames: ['u_matrix', 'u_color']
    },
    fill: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/fill.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/fill.vertex.glsl'), 'utf8'),
        attributeNames: ['a_pos'],
        uniformNames: ['u_matrix', 'u_color']
    },
    circle: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/circle.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/circle.vertex.glsl'), 'utf8'),
        attributeNames: ['a_pos'],
        uniformNames: ['u_matrix', 'u_exmatrix', 'u_blur', 'u_size', 'u_color']
    },
    line: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/line.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/line.vertex.glsl'), 'utf8'),
        attributeNames: ['a_pos', 'a_data'],
        uniformNames: ['u_matrix', 'u_linewidth', 'u_color', 'u_ratio', 'u_blur', 'u_extra', 'u_antialiasingmatrix', 'u_offset', 'u_exmatrix']
    },
    linepattern: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/linepattern.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/linepattern.vertex.glsl'), 'utf8'),
        attributeNames:['a_pos', 'a_data'],
        uniformNames:['u_matrix', 'u_linewidth', 'u_ratio', 'u_pattern_size_a', 'u_pattern_size_b', 'u_pattern_tl_a', 'u_pattern_br_a', 'u_pattern_tl_b', 'u_pattern_br_b', 'u_blur', 'u_fade', 'u_opacity', 'u_extra', 'u_antialiasingmatrix', 'u_offset']
    },
    linesdfpattern: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/linesdfpattern.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/linesdfpattern.vertex.glsl'), 'utf8'),
        attributeNames: ['a_pos', 'a_data'],
        uniformNames: ['u_matrix', 'u_linewidth', 'u_color', 'u_ratio', 'u_blur', 'u_patternscale_a', 'u_tex_y_a', 'u_patternscale_b', 'u_tex_y_b', 'u_image', 'u_sdfgamma', 'u_mix', 'u_extra', 'u_antialiasingmatrix', 'u_offset']
    },
    outline: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/outline.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/outline.vertex.glsl'), 'utf8'),
        attributeNames: ['a_pos'],
        uniformNames: ['u_matrix', 'u_color', 'u_world']
    },
    outlinepattern: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/outlinepattern.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/outlinepattern.vertex.glsl'), 'utf8'),
        attributeNames: ['a_pos'],
        uniformNames: ['u_matrix', 'u_world', 'u_pattern_tl_a', 'u_pattern_br_a', 'u_pattern_tl_b', 'u_pattern_br_b', 'u_mix', 'u_patternscale_a', 'u_patternscale_b', 'u_opacity', 'u_image', 'u_offset_a', 'u_offset_b']
    },
    pattern: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/pattern.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/pattern.vertex.glsl'), 'utf8'),
        attributeNames: ['a_pos'],
        uniformNames: ['u_matrix', 'u_pattern_tl_a', 'u_pattern_br_a', 'u_pattern_tl_b', 'u_pattern_br_b', 'u_mix', 'u_patternscale_a', 'u_patternscale_b', 'u_opacity', 'u_image', 'u_offset_a', 'u_offset_b']
    },
    raster: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/raster.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/raster.vertex.glsl'), 'utf8'),
        attributeNames: ['a_pos', 'a_texture_pos'],
        uniformNames: ['u_matrix', 'u_brightness_low', 'u_brightness_high', 'u_saturation_factor', 'u_spin_weights', 'u_contrast_factor', 'u_opacity0', 'u_opacity1', 'u_image0', 'u_image1', 'u_tl_parent', 'u_scale_parent', 'u_buffer_scale']
    },
    icon: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/icon.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/icon.vertex.glsl'), 'utf8'),
        attributeNames: ['a_pos', 'a_offset', 'a_data1', 'a_data2'],
        uniformNames: ['u_matrix', 'u_exmatrix', 'u_texture', 'u_texsize', 'u_zoom', 'u_fadetexture', 'u_opacity', 'u_skewed', 'u_extra']
    },
    sdf: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/sdf.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/sdf.vertex.glsl'), 'utf8'),
        attributeNames: ['a_pos', 'a_offset', 'a_data1', 'a_data2'],
        uniformNames: ['u_matrix', 'u_exmatrix', 'u_texture', 'u_texsize', 'u_color', 'u_gamma', 'u_buffer', 'u_zoom', 'u_fadetexture', 'u_skewed', 'u_extra']
    },
    collisionbox: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/collisionbox.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/collisionbox.vertex.glsl'), 'utf8'),
        attributeNames: ['a_pos', 'a_extrude', 'a_data'],
        uniformNames: ['u_matrix', 'u_scale', 'u_zoom', 'u_maxzoom']
    }
};

module.exports._createProgram = function(name) {
    var gl = this.gl;
    var program = gl.createProgram();
    var definition = definitions[name];

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, definition.fragmentSource);
    gl.compileShader(fragmentShader);
    assert(gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS), gl.getShaderInfoLog(fragmentShader));
    gl.attachShader(program, fragmentShader);

    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, definition.vertexSource);
    gl.compileShader(vertexShader);
    assert(gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS), gl.getShaderInfoLog(vertexShader));
    gl.attachShader(program, vertexShader);

    gl.linkProgram(program);
    assert(gl.getProgramParameter(program, gl.LINK_STATUS), gl.getProgramInfoLog(program));

    var attributes = {};
    for (var i = 0; i < definition.attributeNames.length; i++) {
        var attributeName = definition.attributeNames[i];
        attributes[attributeName] = gl.getAttribLocation(program, attributeName);
        assert(attributes[attributeName] >= 0);
    }

    var uniforms = {};
    for (var j = 0; j < definition.uniformNames.length; j++) {
        var uniformName = definition.uniformNames[j];
        uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
    }

    return util.extend({
        program: program,
        definition: definition,
        attributes: attributes
    }, attributes, uniforms);
};

module.exports._createProgramCached = function(name) {
    this.cache = this.cache || {};
    if (!this.cache[name]) {
        this.cache[name] = this._createProgram(name);
    }
    return this.cache[name];
};

module.exports.useProgram = function (nextProgramName, posMatrix, exMatrix) {
    var gl = this.gl;

    var nextProgram = this._createProgramCached(nextProgramName);
    var previousProgram = this.currentProgram;

    if (previousProgram !== nextProgram) {
        gl.useProgram(nextProgram.program);

        // Disable all attributes from the existing program that aren't used in
        // the new program. Note: attribute indices are *not* program specific!
        var nextAttributes = util.objectValues(nextProgram.attributes);
        var previousAttributes = util.objectValues((previousProgram && previousProgram.attributes) || {});

        for (var i = 0; i < previousAttributes.length; i++) {
            if (nextAttributes.indexOf(previousAttributes[i]) < 0) {

                // WebGL breaks if you disable attribute 0.
                // http://stackoverflow.com/questions/20305231
                assert(previousAttributes[i] !== 0);

                gl.disableVertexAttribArray(previousAttributes[i]);
            }
        }

        // Enable all attributes for the new program.
        for (var j = 0; j < nextAttributes.length; j++) {
            if (previousAttributes.indexOf(nextAttributes[j]) < 0) {
                gl.enableVertexAttribArray(nextAttributes[j]);
            }
        }

        this.currentProgram = nextProgram;
    }

    if (posMatrix !== undefined) this.setPosMatrix(posMatrix);
    if (exMatrix !== undefined) this.setExMatrix(exMatrix);

    return nextProgram;
};
