// source: http://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
function titlecase(str) {
    return str.replace(/\w\S*/g, function(txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}

function to_css_color(color) {
    var r = Math.round(color[0] * 255),
        g = Math.round(color[1] * 255),
        b = Math.round(color[2] * 255);
    return '#' + (r < 16 ? '0' : '') + r.toString(16) +
                 (g < 16 ? '0' : '') + g.toString(16) +
                 (b < 16 ? '0' : '') + b.toString(16);
}

function css2rgb(c) {
    var x = function(i, size) {
        return Math.round(parseInt(c.substr(i, size), 16) /
            (Math.pow(16, size) - 1) * 255);
    };
    if (c[0] === '#' && c.length == 7) {
        return {R:x(1, 2), G:x(3, 2), B:x(5, 2)};
    } else if (c[0] === '#' && c.length == 4) {
        return {R:x(1, 1), G:x(2, 1), B:x(3, 1)};
    } else {
        var rgb = c.match(/\d+/g);
        return {R:rgb[0], G:rgb[1], B:rgb[2]};
    }
};
