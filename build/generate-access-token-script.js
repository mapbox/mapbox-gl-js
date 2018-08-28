/* eslint-disable */
'use strict';
const fs = require('fs');
const path = require('path');
const script = fs.readFileSync(path.join(__dirname, '../debug/access_token.js'), 'utf-8')
    .replace('process.env.MapboxAccessToken',
        JSON.stringify(process.env.MapboxAccessToken))
    .replace('process.env.MAPBOX_ACCESS_TOKEN',
        JSON.stringify(process.env.MAPBOX_ACCESS_TOKEN));

fs.writeFileSync(path.join(__dirname, '../debug/access_token_generated.js'), script);
