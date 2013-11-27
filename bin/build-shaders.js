var fs = require('fs');
var path = require('path');

module.exports = function() {
    var shaders = {};

    var shaderFiles = fs.readdirSync('shaders');

    for (var i = 0; i < shaderFiles.length; i++) {
        var parts = shaderFiles[i].match(/^(.+)\.(vertex|fragment)\.glsl$/);
        if (parts) {
            var name = parts[1], type = parts[2];
            if (!(name in shaders)) {
                shaders[name] = {};
            }
            shaders[name][type] = fs.readFileSync(path.join('shaders', shaderFiles[i]), 'utf8');
        }
    }

    var code = "// NOTE: DO NOT CHANGE THIS FILE. IT IS AUTOMATICALLY GENERATED.\n\n";
    code += "module.exports = " + JSON.stringify(shaders, null, 4) + ";\n";

    fs.writeFileSync('js/render/shaders.js', code);
};
