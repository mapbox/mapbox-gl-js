var util = require('./util.js');
var console = require('./console.js');

module.exports = {
    fn: fn
};

function fn(anchor, offset, line, segment, direction) {
    var glyphs = [];
    direction = 1;
    var ratio = 8; // 8 tile pixels per 1 screen pixel at tile base
    segment++;

    if (offset < 0) {
        direction *= -1;
        segment--;
        offset *= -1;
    }
    var end = line[segment];
    var prevscale = Infinity;

    if ((anchor.x - end.x) * direction > 0) return glyphs;

    while (true) {
        var dist = util.dist(anchor, end);
        var scale = offset/dist * ratio / 2;

        glyphs.push({
            anchor: anchor,
            minScale: scale,
            maxScale: prevscale,
            angle:  -Math.atan2(end.x - anchor.x, end.y - anchor.y) + Math.PI / 2
        });

        segment += direction;
        anchor = end;
        end = line[segment];
        if (!end) break;

        var unit = util.unit(util.vectorSub(end, anchor));
        anchor = util.vectorSub(anchor, { x: unit.x * dist, y: unit.y * dist });
        prevscale = scale;

    }

    return glyphs;
}
