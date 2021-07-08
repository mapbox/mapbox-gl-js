const iterateJsdoc = require('eslint-plugin-jsdoc/dist/iterateJsdoc.js').default;

const OPTIONAL_PREFIX_REGEX = /^(\s*\(optional\)\s*)/;

module.exports = iterateJsdoc(({
    utils,
}) => {
    utils.forEachPreferredTag('param', (tag) => {
        if (OPTIONAL_PREFIX_REGEX.test(tag.description)) {
            utils.reportJSDoc(`"(optional)" prefix not permitted on @${tag.tag}.`, tag, () => {
                utils.changeTag(tag, {
                    name: tag.optional ? tag.name : `[${tag.name}]`,
                    description: tag.description.replace(OPTIONAL_PREFIX_REGEX, ''),
                });
            });
        }
    });
}, {
    contextDefaults: true,
    meta: {
        docs: {
            description: 'Forbids usage of "(optional)" in param descriptions in favor of square brackets around the param name.',
        },
        fixable: 'code',
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
