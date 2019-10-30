/* eslint-disable import/no-commonjs */
/* eslint-disable flowtype/require-valid-file-annotation */
const browserify = require('browserify');
const fs = require('fs');

module.exports = function() {
    return new Promise((resolve, reject) => {
        browserify(require.resolve('../../test/util/tape_config.js'), { standalone: 'tape' })
            .bundle((err, buff) => {
                if (err) { throw err; }

                fs.writeFile('test/integration/dist/tape.js', buff, { encoding: 'utf8'}, (err) => {
                    if (err) { reject(err); }
                    resolve();
                });
            });
    });
};
