
var beautify = require('js-beautify').js_beautify,
    argv = require('minimist')(process.argv.slice(2));

var input = require('./' + argv._[0]),
    output;

if (!input.version) {
    output = require('./migrations/v1')(input);
} else {
    output = require('./migrations/out')(input);
}

function format(json) {
    return beautify(JSON.stringify(json), {
        indent_size: 2,
        keep_array_indentation: true
    });
}

// result = result.replace(/{[^{}]*}/g, function (str) {
//  var str2 = str.replace(/\s/g, '').replace(/:/g, ': ').replace(/,/g, ', ');
//  return str2.length < 100 ? str2 : str;
// });

console.log('module.exports = ' + format(output));
