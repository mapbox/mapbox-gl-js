var util = require('./util.js');
var console = require('./console.js');

module.exports = {
    fn: fn
};

function fn(anchor, offset, line, segment, direction) {
    var glyphs = [];

    var upsideDown = direction < 0;

    if (offset < 0)  direction *= -1;

    if (direction > 0) segment++;

    var newAnchor = anchor;
    var end = line[segment];
    var prevscale = Infinity;

    offset = Math.abs(offset);

    var placementScale = anchor.scale;

    segment_loop:
    while (true) {
        var dist = util.dist(newAnchor, end);
        var scale = offset/dist;
        var angle = -Math.atan2(end.x - newAnchor.x, end.y - newAnchor.y) + direction * Math.PI / 2;
        if (upsideDown) angle += Math.PI;

        // Don't place around sharp corners
        //if (Math.abs(angle) > 3/8 * Math.PI) break;

        glyphs.push({
            anchor: newAnchor,
            offset: upsideDown ? Math.PI : 0,
            minScale: scale,
            maxScale: prevscale,
            angle: (angle + 2 * Math.PI) % (2 * Math.PI)
        });

        if (scale <= placementScale) break;

        newAnchor = end;

        // skip duplicate nodes
        while (newAnchor.x === end.x && newAnchor.y === end.y) {
            segment += direction;
            end = line[segment];

            if (!end) {
                anchor.scale = scale;
                break segment_loop;
            }
        }

        var unit = util.unit(util.vectorSub(end, newAnchor));
        newAnchor = util.vectorSub(newAnchor, { x: unit.x * dist, y: unit.y * dist });
        prevscale = scale;

    }

    glyphs.angleOffset = direction === 1 ? 0 : Math.PI;

    return glyphs;
}
