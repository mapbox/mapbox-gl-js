import fs from 'fs';

const version = JSON.parse(fs.readFileSync('package.json')).version;
export default `/* Mapbox GL JS is licensed under the 3-Clause BSD License. Full text of license: https://github.com/mapbox/mapbox-gl-js/blob/v${version}/LICENSE.txt */`;
