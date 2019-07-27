var browserify = require('browserify');
var fs = require('fs');


var b = browserify(require.resolve('tape'), { standalone: 'tape' })
    .bundle((err, buff) => {
        if(err) { throw err; }

        fs.writeFileSync('rollup/build/test/tape.js', buff, { encoding: 'utf8'});
    });
