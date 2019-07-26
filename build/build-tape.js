var browserify = require('browserify');
var babelify = require('babelify');
var fs = require('fs');


var b = browserify('test/util/tape_index.js', { standalone: 'tape' })
    .transform(babelify, { presets: [ '@babel/preset-env' ] })
    .bundle((err, buff) => {
        if(err) { throw err; }

        fs.writeFileSync('test/util/tape_build.js', buff, { encoding: 'utf8'});
    });
