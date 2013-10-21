var fns = {};

fns.linear = function(z_base, val, slope, min, max) {
    z_base = +z_base || 0;
    val = +val || 0;
    slope = +slope || 0;
    min = +min || 0;
    max = +max || Infinity;
    return function(z) {
        return Math.min(Math.max(min, val + (z - z_base) * slope), max);
    };
};


fns.exponential = function(z_base, val, slope, min, max) {
    z_base = +z_base || 0;
    val = +val || 0;
    slope = +slope || 0;
    min = +min || 0;
    max = +max || Infinity;
    return function(z) {
        return Math.min(Math.max(min, val + Math.pow(1.75, (z - z_base)) * slope), max);
    };
};


fns.min = function(min_z) {
    min_z = +min_z || 0;
    return function(z) {
        return z >= min_z;
    };
};

// Convert color to premultiplyAlpha alpha
function premultiplyAlpha(c) {
    var alpha = c[3];
    return [c[0] * alpha, c[1] * alpha, c[2] * alpha, alpha];
}

function parse_color(color, constants) {
    if (typeof color === 'string' && color[0] !== '#') {
        color = constants[color];
    }

    // Convert color to WebGL color.
    if (typeof color === 'string') {
        if (color.length === 4 && color[0] === '#') {
            return [
                parseInt(color[1] + color[1], 16) / 255,
                parseInt(color[2] + color[2], 16) / 255,
                parseInt(color[3] + color[3], 16) / 255,
                1.0
            ];
        } else if (color.length === 7 && color[0] === '#') {
            return [
                parseInt(color[1] + color[2], 16) / 255,
                parseInt(color[3] + color[4], 16) / 255,
                parseInt(color[5] + color[6], 16) / 255,
                1.0
            ];
        } else {
            throw new Error("Invalid color " + color);
        }
    }

    return premultiplyAlpha(color);
}

function parse_value(value, constants, z) {
    if (typeof value === 'function') {
        return value(z, constants);
    } else {
        return value;
    }
}


function parse_fn(fn) {
    if (Array.isArray(fn)) {
        return fns[fn[0]].apply(null, fn.slice(1));
    } else {
        return fn;
    }
}

function parse_width(width) {
    width = parse_fn(width);
    var value = +width;
    return !isNaN(value) ? value : width;
}

function parse_style(layers, constants) {
    return layers.map(function parse(layer) {
        var result = { bucket: layer.bucket };
        if ('enabled' in layer) result.enabled = parse_fn(layer.enabled, constants);
        if ('opacity' in layer) result.opacity = parse_fn(layer.opacity, constants);
        if ('color' in layer) result.color = layer.color; //parse_color(layer.color, constants);
        if ('width' in layer) result.width = parse_width(layer.width);
        if ('offset' in layer) result.offset = parse_width(layer.offset);
        if ('antialias' in layer) result.antialias = layer.antialias;
        if ('image' in layer) result.image = layer.image;
        if ('alignment' in layer) result.alignment = layer.alignment;
        if ('fontSize' in layer) result.fontSize = layer.fontSize;
        if ('dasharray' in layer) result.dasharray = [parse_width(layer.dasharray[0]), parse_width(layer.dasharray[1])];
        if ('layers' in layer) result.layers = layer.layers.map(parse);
        return result;
    });
}

function enabled(layer) {
    return (!layer.layers || layer.layers.length) && (!('enabled' in layer) || layer.enabled);
}

function zoom_style(layers, constants, z) {
    return layers.map(function parse(layer) {
        var result = { bucket: layer.bucket };
        if ('enabled' in layer) result.enabled = parse_value(layer.enabled, constants, z);
        if ('color' in layer) result.color = parse_value(parse_color(layer.color, constants), constants, z);
        if ('width' in layer) result.width = parse_value(layer.width, constants, z);
        if ('offset' in layer) result.offset = parse_value(layer.offset, constants, z);
        if ('opacity' in layer && result.color) {
            result.color[3] = parse_value(layer.opacity, constants, z);
            result.color = premultiplyAlpha(result.color);
        } else if ('opacity' in layer) result.opacity = parse_value(layer.opacity, constants, z);
        if ('antialias' in layer) result.antialias = layer.antialias;
        if ('image' in layer) result.image = layer.image;
        if ('alignment' in layer) result.alignment = layer.alignment;
        if ('font' in layer) result.font = layer.font;
        if ('fontSize' in layer) result.fontSize = layer.fontSize;
        if ('dasharray' in layer) result.dasharray = [parse_width(layer.dasharray[0]), parse_width(layer.dasharray[1])];
        if ('layers' in layer) result.layers = layer.layers.map(parse).filter(enabled);
        return result;
    }).filter(enabled);
}
