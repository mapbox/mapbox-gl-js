var browserify = require('browserify');
var fs = require('fs');


var b = browserify(require.resolve('../../test/util/tape_config.js'), { standalone: 'test' })
    .bundle((err, buff) => {
        if(err) { throw err; }

        fs.writeFileSync('test/dist/test.js', buff, { encoding: 'utf8'});
    });
