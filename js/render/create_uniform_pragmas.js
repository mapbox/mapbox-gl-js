'use strict';

var assert = require('assert');

module.exports = function(uniforms) {
    var pragmas = { define: {}, initialize: {} };

    for (var i = 0; i < uniforms.length; i++) {
        var uniform = uniforms[i];
        assert(uniform.name.slice(0, 2) === 'u_');

        var type = '{precision} ' + (uniform.components === 1 ? 'float' : 'vec' + uniform.components);
        pragmas.define[uniform.name.slice(2)] = 'uniform ' + type + ' ' + uniform.name + ';\n';
        pragmas.initialize[uniform.name.slice(2)] = type + ' ' + uniform.name.slice(2) + ' = ' + uniform.name + ';\n';
    }

    return pragmas;
};
