const formatMapboxGLJS = require('./rules/format-mapbox-gl-js.js');

module.exports = {
    configs: {
        recommended: {
            plugins: ['jsdoc-custom'],
            rules: {
                'jsdoc-custom/require-defaults': 'warn'
            },
        },
    },
    rules: {
        'format-mapbox-gl-js': formatMapboxGLJS
    },
};
