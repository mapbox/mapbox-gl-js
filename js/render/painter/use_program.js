'use strict';

var assert = require('assert');
var util = require('../../util/util');
var shaders = require('mapbox-gl-shaders');

var utilSource = shaders.util;

module.exports._createProgram = function(name, defines, vertexPragmas, fragmentPragmas) {
    var gl = this.gl;
    var program = gl.createProgram();
    var definition = shaders[name];

    var definesSource = '#define MAPBOX_GL_JS;\n';
    for (var j = 0; j < defines.length; j++) {
        definesSource += '#define ' + defines[j] + ';\n';
    }

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, applyPragmas(definesSource + definition.fragmentSource, fragmentPragmas));
    gl.compileShader(fragmentShader);
    assert(gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS), gl.getShaderInfoLog(fragmentShader));
    gl.attachShader(program, fragmentShader);

    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, applyPragmas(definesSource + utilSource + definition.vertexSource, vertexPragmas));
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

module.exports._createProgramCached = function(name, defines, vertexPragmas, fragmentPragmas) {
    this.cache = this.cache || {};

    var key = JSON.stringify({
        name: name,
        defines: defines,
        vertexPragmas: vertexPragmas,
        fragmentPragmas: fragmentPragmas
    });

    if (!this.cache[key]) {
        this.cache[key] = this._createProgram(name, defines, vertexPragmas, fragmentPragmas);
    }
    return this.cache[key];
};

module.exports.useProgram = function (nextProgramName, defines, vertexPragmas, fragmentPragmas) {
    var gl = this.gl;

    defines = defines || [];
    if (this._showOverdrawInspector) {
        defines = defines.concat('OVERDRAW_INSPECTOR');
    }

    var nextProgram = this._createProgramCached(nextProgramName, defines, vertexPragmas, fragmentPragmas);
    var previousProgram = this.currentProgram;

    if (previousProgram !== nextProgram) {
        gl.useProgram(nextProgram.program);
        this.currentProgram = nextProgram;
    }

    return nextProgram;
};

function applyPragmas(source, pragmas) {
    return source.replace(/#pragma mapbox: ([\w]+) ([\w]+) ([\w]+) ([\w]+)/g, function(match, operation, precision, type, name) {
        return pragmas[operation][name].replace(/{type}/g, type).replace(/{precision}/g, precision);
    });
}
