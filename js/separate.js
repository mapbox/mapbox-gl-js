var util = require('./util.js');
var console = require('./console.js');

module.exports = {
    fn: fn
};

function fn(anchor, offset, line, segment, direction) {
    var glyphs = [];
    var ratio = 8; // 8 tile pixels per 1 screen pixel at tile base

    var upsideDown = direction < 0;

    if ((offset < 0 && direction > 0) ||
        (offset > 0 && direction < 0)) {
            direction *= -1;
        }

    if (direction > 0) segment++;

    var end = line[segment];
    var prevscale = Infinity;

    var flip = false;
    if (upsideDown) {
        flip = true;
        if (direction > 0) segment--;
        direction *= -1;
        if (direction > 0) segment++;
    }
    offset = Math.abs(offset);

    end = line[segment];

    //if ((anchor.x - end.x) * direction > 0) return glyphs;

    while (true) {
        var dist = util.dist(anchor, end);
        var scale = offset/dist * ratio / 2;
        var angle = -Math.atan2(end.x - anchor.x, end.y - anchor.y) + direction * Math.PI / 2;
        if (flip) angle += Math.PI;
        angle = (angle + 2 * Math.PI) % ( 2 * Math.PI);

        //angle += direction < 0 ? Math.PI : 0;

        // Don't place around sharp corners
        //if (Math.abs(angle) > 3/8 * Math.PI) break;

        glyphs.push({
            anchor: anchor,
            offset: 0,
            offset: !upsideDown ? 0 : Math.PI,
            minScale: scale,
            maxScale: prevscale,
            angle: angle
        });

        segment += direction;
        anchor = end;
        end = line[segment];
        if (!end) break;

        var unit = util.unit(util.vectorSub(end, anchor));
        anchor = util.vectorSub(anchor, { x: unit.x * dist, y: unit.y * dist });
        prevscale = scale;

    }

    glyphs.angleOffset = direction === 1 ? 0 : Math.PI;

    return glyphs;
}
