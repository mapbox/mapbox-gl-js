const descriptiveTags = new Set([
    'summary', 'file', 'fileoverview', 'overview', 'classdesc', 'todo',
    'deprecated', 'throws', 'exception', 'yields', 'yield', 'param', 'returns'
]);

module.exports = function iterateDescriptiveTags(utils, jsdoc, callback) {
    callback({
        description: utils.getDescription(),
        tag: {line: jsdoc.source[0].number + 1}
    });

    const {tagsWithNames} = utils.getTagsByType(jsdoc.tags);
    const tagsWithoutNames = utils.filterTags(({tag: tagName}) => {
        return descriptiveTags.has(tagName) ||
            utils.hasOptionTag(tagName) && !tagsWithNames.some(({tag}) => tag === tagName);
    });

    tagsWithNames.forEach((tag) => {
        const description = utils.getDescription(tag);
        callback({description, tag});

        callback({description: tag, tag});
    });

    tagsWithoutNames.forEach((tag) => {
        const description = utils.getDescription(tag);
        callback({description, tag});
    });
};
