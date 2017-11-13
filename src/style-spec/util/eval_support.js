// @flow

module.exports = (function () {
    try {
        new Function('');
        return true;
    } catch (e) {
        return false;
    }
})();
