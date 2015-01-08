'use strict';

var traceur = require('traceur');

require('traceur-source-maps').install(traceur);

traceur.require.makeDefault(function(filename) {
    return !(/node_modules/.test(filename));
}, {
    arrowFunctions: true,
    propertyMethods: true,
    modules: 'commonjs',
    propertyNameShorthand: true,
    asyncFunctions: true
});
