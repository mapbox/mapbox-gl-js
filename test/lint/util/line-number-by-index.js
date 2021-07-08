/**
 * Return the line number in a string by character position.
 * @param {string} str string of text analyzed.
 * @param {number} index offset relative to start of string.
 * @returns {number} line number at offset
 * @private
 */
module.exports = function lineNumberByIndex(string, index) {
    let match;
    let line = 0;
    const re = /(^)[\S\s]/gm;
    while ((match = re.exec(string))) {
        if (match.index > index) break;
        line++;
    }
    return line;
};
