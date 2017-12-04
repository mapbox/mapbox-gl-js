const through = require('through2');

function replacer(k, v) {
    return (k === 'doc' || k === 'example' || k === 'sdk-support') ? undefined : v;
}

module.exports = (path) => {
    if (path.match(/style\-spec[\\/]reference[\\/]v[0-9]+\.json$/)) {
        let source = '';
        return through(
            // eslint-disable-next-line prefer-arrow-callback
            function (sourceChunk, encoding, callback) {
                source += sourceChunk.toString('utf8');
                callback();
            },
            // eslint-disable-next-line prefer-arrow-callback
            function (callback) {
                this.push(JSON.stringify(JSON.parse(source), replacer, 0));
                callback();
            }
        );
    } else {
        return through();
    }
};
