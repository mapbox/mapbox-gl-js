var fs = require('fs');
var path = require('path');

// readFileSync calls must be written out long-form for brfs.
module.exports = {
  prelude: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/_prelude.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/_prelude.vertex.glsl'), 'utf8')
  },
  circle: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/circle.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/circle.vertex.glsl'), 'utf8')
  },
  collisionBox: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/collision_box.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/collision_box.vertex.glsl'), 'utf8')
  },
  debug: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/debug.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/debug.vertex.glsl'), 'utf8')
  },
  fill: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/fill.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/fill.vertex.glsl'), 'utf8')
  },
  fillOutline: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/fill_outline.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/fill_outline.vertex.glsl'), 'utf8')
  },
  fillOutlinePattern: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/fill_outline_pattern.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/fill_outline_pattern.vertex.glsl'), 'utf8')
  },
  fillPattern: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/fill_pattern.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/fill_pattern.vertex.glsl'), 'utf8')
  },
  fillExtrusion: {
      fragmentSource: fs.readFileSync(path.join(__dirname, 'src/fill_extrusion.fragment.glsl'), 'utf8'),
      vertexSource: fs.readFileSync(path.join(__dirname, 'src/fill_extrusion.vertex.glsl'), 'utf8')
  },
  fillExtrusionPattern: {
      fragmentSource: fs.readFileSync(path.join(__dirname, 'src/fill_extrusion_pattern.fragment.glsl'), 'utf8'),
      vertexSource: fs.readFileSync(path.join(__dirname, 'src/fill_extrusion_pattern.vertex.glsl'), 'utf8')
  },
  extrusionTexture: {
      fragmentSource: fs.readFileSync(path.join(__dirname, 'src/extrusion_texture.fragment.glsl'), 'utf8'),
      vertexSource: fs.readFileSync(path.join(__dirname, 'src/extrusion_texture.vertex.glsl'), 'utf8')
  },
  line: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/line.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/line.vertex.glsl'), 'utf8')
  },
  linePattern: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/line_pattern.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/line_pattern.vertex.glsl'), 'utf8')
  },
  lineSDF: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/line_sdf.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/line_sdf.vertex.glsl'), 'utf8')
  },
  raster: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/raster.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/raster.vertex.glsl'), 'utf8')
  },
  symbolIcon: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/symbol_icon.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/symbol_icon.vertex.glsl'), 'utf8')
  },
  symbolSDF: {
    fragmentSource: fs.readFileSync(path.join(__dirname, 'src/symbol_sdf.fragment.glsl'), 'utf8'),
    vertexSource: fs.readFileSync(path.join(__dirname, 'src/symbol_sdf.vertex.glsl'), 'utf8')
  }
};
