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

var vertexSourcePrelude = (
    'float evaluate_zoom_function_1(const vec4 values, const float t) {' +
    '    if (t < 1.0) {' +
    '        return mix(values[0], values[1], t);' +
    '    } else if (t < 2.0) {' +
    '        return mix(values[1], values[2], t - 1.0);' +
    '    } else {' +
    '        return mix(values[2], values[3], t - 2.0);' +
    '    }' +
    '}' +
    'vec4 evaluate_zoom_function_4(const vec4 value0, const vec4 value1, const vec4 value2, const vec4 value3, const float t) {' +
    '    if (t < 1.0) {' +
    '        return mix(value0, value1, t);' +
    '    } else if (t < 2.0) {' +
    '        return mix(value1, value2, t - 1.0);' +
    '    } else {' +
    '        return mix(value2, value3, t - 2.0);' +
    '    }' +
    '}'
);

module.exports._createProgram = function(name, defines, vertexPragmas, fragmentPragmas) {
    var gl = this.gl;
    var program = gl.createProgram();
    var definition = definitions[name];

    var definesSource = '';
    for (var j = 0; definesSource && j < definesSource.length; j++) {
        definesSource += '#define ' + defines[j] + '\;n';
    }

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, applyPragmas(definesSource + definition.fragmentSource, fragmentPragmas));
    gl.compileShader(fragmentShader);
    assert(gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS), gl.getShaderInfoLog(fragmentShader));
    gl.attachShader(program, fragmentShader);

    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, applyPragmas(definesSource + vertexSourcePrelude + definition.vertexSource, vertexPragmas));
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

    var nextProgram = this._createProgramCached(nextProgramName, defines, vertexPragmas, fragmentPragmas);
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

function applyPragmas(source, pragmas) {
    for (var key in pragmas) {
        source = source.replace('#pragma mapbox: ' + key, pragmas[key]);
    }
    return source;
}
