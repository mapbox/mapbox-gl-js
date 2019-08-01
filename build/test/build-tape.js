var browserify = require('browserify');
var fs = require('fs');


var b = browserify(require.resolve('../../test/util/tape_config.js'), { standalone: 'tape' })
    .bundle((err, buff) => {
        if(err) { throw err; }

        fs.writeFileSync('test/dist/tape.js', buff, { encoding: 'utf8'});
    });
