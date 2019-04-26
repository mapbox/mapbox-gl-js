#!/usr/bin/env node
'use strict';

const path = require('path'); // eslint-disable-line import/no-commonjs
const appropriateImages = require('@mapbox/appropriate-images'); // eslint-disable-line import/no-commonjs
const imageConfig = require('../img/dist/image.config.json'); // eslint-disable-line import/no-commonjs

appropriateImages.createCli(imageConfig, {
    inputDirectory: path.join(__dirname, '../img/src'),
    outputDirectory: path.join(__dirname, '../img/dist')
});
