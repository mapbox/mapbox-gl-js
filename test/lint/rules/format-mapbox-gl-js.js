const iterateJsdoc = require('eslint-plugin-jsdoc/dist/iterateJsdoc.js').default;
const iterateDescriptiveTags = require('../util/iterate-descriptive-tags.js');
const lineNumberByIndex = require('../util/line-number-by-index');

const FORBIDDEN_GL_JS_REGEX = /(GL-JS|[^x][\s\r\g]+GL JS)/g;

function createDescriptionValidator(utils) {
    return function ({description, tag}) {
        if (!description) return;

        const text = description.description;
        const joinedText = text.split(/\n/).map(x => x.trim()).join(' ');

        const forbiddenMatchIndex = joinedText.search(FORBIDDEN_GL_JS_REGEX);
        if (forbiddenMatchIndex !== -1) {
            const tagline = tag && tag.source ? tag.source[0].number : 0;
            const line = tagline + lineNumberByIndex(text, forbiddenMatchIndex);

            utils.reportJSDoc(`"Mapbox GL JS" should not be hyphenated or omit "Mapbox".`, {line});
        }
    };
}

module.exports = iterateJsdoc(({jsdoc, utils}) => {
    const validator = createDescriptionValidator(utils);

    iterateDescriptiveTags(utils, jsdoc, validator);
}, {
    contextDefaults: true,
    iterateAllJsdocs: true,
    meta: {
        docs: {
            description: 'This rule enforces consistent usage of the name "Mapbox GL JS" to refer to the project.',
        },
        fixable: 'code',
        schema: [
            {
                additionalProperties: false,
                properties: {
                },
                type: 'object',
            },
        ],
        type: 'suggestion',
    },
});
