var fs = require('fs');
var path = require('path');

// readFileSync calls must be written out long-form for brfs.
module.exports = {
  debug: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/debug.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/debug.vertex.glsl'), 'utf8')
  },
  fill: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/fill.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/fill.vertex.glsl'), 'utf8')
  },
  circle: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/circle.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/circle.vertex.glsl'), 'utf8')
  },
  line: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/line.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/line.vertex.glsl'), 'utf8')
  },
  linepattern: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/linepattern.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/linepattern.vertex.glsl'), 'utf8')
  },
  linesdfpattern: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/linesdfpattern.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/linesdfpattern.vertex.glsl'), 'utf8')
  },
  outline: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/outline.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/outline.vertex.glsl'), 'utf8')
  },
  outlinepattern: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/outlinepattern.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/outlinepattern.vertex.glsl'), 'utf8')
  },
  pattern: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/pattern.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/pattern.vertex.glsl'), 'utf8')
  },
  raster: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/raster.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/raster.vertex.glsl'), 'utf8')
  },
  icon: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/icon.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/icon.vertex.glsl'), 'utf8')
  },
  sdf: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/sdf.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/sdf.vertex.glsl'), 'utf8')
  },
  collisionbox: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/collisionbox.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/collisionbox.vertex.glsl'), 'utf8')
  }
};

module.exports.util = fs.readFileSync(path.join(__dirname, 'util.vertex.glsl'), 'utf8');
