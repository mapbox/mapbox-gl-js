const iterateJsdoc = require('eslint-plugin-jsdoc/dist/iterateJsdoc.js').default;

const OPTIONAL_PREFIX_REGEX = /^(\s*\(optional\)\s*)/g;

module.exports = iterateJsdoc(({
    utils,
    report,
}) => {
    utils.forEachPreferredTag('param', (tag) => {
        if (OPTIONAL_PREFIX_REGEX.test(tag.description)) {
            report(`use square brackets around @${tag.tag} name instead of "(optional)" in description`, null, tag);
        }
    });
}, {
    contextDefaults: true,
    meta: {
        docs: {
            description: 'Forbids usage of "(optional)" in param descriptions in favor of square brackets around the param name.',
        },
        schema: [
            {
                additionalProperties: false,
                properties: {
                    contexts: {
                        items: {
                            anyOf: [
                                {
                                    type: 'string',
                                },
                                {
                                    additionalProperties: false,
                                    properties: {
                                        comment: {
                                            type: 'string',
                                        },
                                        context: {
                                            type: 'string',
                                        },
                                    },
                                    type: 'object',
                                },
                            ],
                        },
                        type: 'array',
                    },
                },
                type: 'object',
            },
        ],
        type: 'suggestion',
    },
});
