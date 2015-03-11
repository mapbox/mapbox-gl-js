// GL style reference generator

var fs = require('fs');
var path = require('path');
var documentation = require('documentation');
var lint = require('documentation/streams/lint');
var github = require('documentation/streams/github');
var html = require('documentation/streams/output/html');
var through = require('through');
var pkg = require('../../package.json');

documentation(pkg.main)
    .pipe(lint())
    .pipe(github())
    .pipe(html({
        name: pkg.name,
        version: pkg.version,
        path: __dirname
    }))
    .pipe(through(function (file) {
        if (file.path === 'index.html') {
            fs.writeFileSync(path.join(__dirname, '../_posts/3400-01-01-api.html'), file.contents);
        }
    }));
