'use strict';

require('flow-remove-types/register');

const suite = require('./integration').render;
const suiteImplementation = require('./suite_implementation');
const ignores = require('./ignores.json');

suite.run('js', ignores, suiteImplementation);
