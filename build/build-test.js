var browserify = require('browserify');
var unflowify = require('unflowify');
var babelify = require('babelify');
var fs = require('fs');
var glob = require("glob");
var through = require('through2');


var testFiles = glob.sync('test/unit/ui/**/*.test.js');

function glslify(file) {
    var extension = file.substring(file.lastIndexOf('.') + 1, file.length);
    //Do nothing if not a glsl file
    if( extension !== 'glsl' ) {
        return through();
    }

    return through(function (buf, enc, next) {
        var code = buf.toString('utf8');

        var output = `export default ${JSON.stringify(code)};`
        this.push(output);
        next();
    });
}


var b = browserify()
    .add(testFiles, { debug: true })
    .transform(glslify)
    .transform(unflowify)
    .transform(babelify, {
        extensions: [
            '.js', '.glsl'
        ],
        presets: [
            [
                "@babel/preset-env",
                {
                    targets: {
                        chrome: "58"
                    }
                }
            ]
        ]
    })
    .bundle((err, buff) => {
        if(err) { throw err; }

        fs.writeFileSync('rollup/build/test/unit.js', buff, { encoding: 'utf8'});
    });
