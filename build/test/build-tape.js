const browserify = require('browserify');
const fs = require('fs');


const b = browserify(require.resolve('../../test/util/tape_config.js'), { standalone: 'tape' })
    .bundle((err, buff) => {
        if(err) { throw err; }

        fs.writeFileSync('test/integration/dist/tape.js', buff, { encoding: 'utf8'});
    });
