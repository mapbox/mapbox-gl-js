const fs = require('fs');
const path = require('path')
const plugins = require('../docs/_data/plugins');

for (var plugin in plugins) {
  plugin = plugins[plugin];
  for (var version in plugin.v) {
    var dir = plugin.prefix + '/v' + version + '/';
    plugin.v[version].files.forEach(function(file) {
      // file check, will err if no such file
      if (!fs.statSync(path.join(__dirname,'src/') + dir + file).isFile()) return process.exit(1);
    });
  }
}
