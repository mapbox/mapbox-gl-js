'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var util = require('../../util/util');

// readFileSync calls must be written out long-form for brfs.
var definitions = {
    debug: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/debug.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/debug.vertex.glsl'), 'utf8')
    },
    fill: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/fill.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/fill.vertex.glsl'), 'utf8')
    },
    circle: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/circle.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/circle.vertex.glsl'), 'utf8')
    },
    line: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/line.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/line.vertex.glsl'), 'utf8')
    },
    linepattern: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/linepattern.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/linepattern.vertex.glsl'), 'utf8')
    },
    linesdfpattern: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/linesdfpattern.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/linesdfpattern.vertex.glsl'), 'utf8')
    },
    outline: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/outline.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/outline.vertex.glsl'), 'utf8')
    },
    outlinepattern: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/outlinepattern.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/outlinepattern.vertex.glsl'), 'utf8')
    },
    pattern: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/pattern.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/pattern.vertex.glsl'), 'utf8')
    },
    raster: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/raster.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/raster.vertex.glsl'), 'utf8')
    },
    icon: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/icon.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/icon.vertex.glsl'), 'utf8')
    },
    sdf: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/sdf.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/sdf.vertex.glsl'), 'utf8')
    },
    collisionbox: {
        fragmentSource: fs.readFileSync(path.join(__dirname, '../../../shaders/collisionbox.fragment.glsl'), 'utf8'),
        vertexSource: fs.readFileSync(path.join(__dirname, '../../../shaders/collisionbox.vertex.glsl'), 'utf8')
    }
};

module.exports._createProgram = function(name, defines) {
    var gl = this.gl;
    var program = gl.createProgram();
    var definition = definitions[name];

    var definesSource = '';
    for (var j = 0; definesSource && j < definesSource.length; j++) {
        definesSource += '#define ' + defines[j] + '\;n';
    }

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, definesSource + definition.fragmentSource);
    gl.compileShader(fragmentShader);
    assert(gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS), gl.getShaderInfoLog(fragmentShader));
    gl.attachShader(program, fragmentShader);

    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, definesSource + definition.vertexSource);
    gl.compileShader(vertexShader);
    assert(gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS), gl.getShaderInfoLog(vertexShader));
    gl.attachShader(program, vertexShader);

    gl.linkProgram(program);
    assert(gl.getProgramParameter(program, gl.LINK_STATUS), gl.getProgramInfoLog(program));

    var attributes = {};
    var numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (var i = 0; i < numAttributes; i++) {
        var attribute = gl.getActiveAttrib(program, i);
        attributes[attribute.name] = gl.getAttribLocation(program, attribute.name);
    }

    var uniforms = {};
    var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var ui = 0; ui < numUniforms; ui++) {
        var uniform = gl.getActiveUniform(program, ui);
        uniforms[uniform.name] = gl.getUniformLocation(program, uniform.name);
    }

    return util.extend({
        program: program,
        definition: definition,
        attributes: attributes,
        numAttributes: numAttributes
    }, attributes, uniforms);
};

module.exports._createProgramCached = function(name, defines) {
    this.cache = this.cache || {};

    var key = JSON.stringify({name: name, defines: defines});
    if (!this.cache[key]) {
        this.cache[key] = this._createProgram(name, defines);
    }
    return this.cache[key];
};

module.exports.useProgram = function (nextProgramName, defines) {
    var gl = this.gl;

    var nextProgram = this._createProgramCached(nextProgramName, defines);
    var previousProgram = this.currentProgram;

    if (this._showOverdrawInspector) {
        defines = defines || [];
        defines.push('OVERDRAW_INSPECTOR');
    }

    if (previousProgram !== nextProgram) {
        gl.useProgram(nextProgram.program);
        this.currentProgram = nextProgram;
    }

    return nextProgram;
};
