const noParamOptionalPrefix = require('./rules/no-param-optional-prefix.js');

module.exports = {
    configs: {
        recommended: {
            plugins: ['jsdoc-custom'],
            rules: {
                'jsdoc-custom/no-param-optional-prefix': 'warn'
            },
        },
    },
    rules: {
        'no-param-optional-prefix': noParamOptionalPrefix
    },
};
