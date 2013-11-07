$(function() {
    new App();
});




var util = llmr.util;

function App() {
    var app = this;

    this.map = new llmr.Map({
        container: document.getElementById('map'),
        layers: [{
            type: 'vector',
            id: 'streets',
            urls: ['/gl/tiles/{z}-{x}-{y}.vector.pbf'],
            zooms: [0, 2, 3, 4, 5, 6, 7, 8, 10, 12, 13, 14]
        }],
        maxZoom: 20,
        zoom: 15,
        lat: 38.912753,
        lon: -77.032194,
        rotation: 0,
        hash: true,
        style: style
    });

    this.map.on('zoom', this.updateZoomLevel.bind(this));
    this.updateZoomLevel();

    $('#layers').sortable({
        axis: "y",
        handle: ".handle",
        cursor: "-webkit-grabbing",
        change: function(e, ui) {
            app.updateStyles(app.getLayerStyles(ui.placeholder[0], ui.item[0]));
        }
    });

    // Background
    var background = $('.layer.background')
    $('.header', background).click(function() {
        // Activate this layer.
        app.switchLayer($());
        background.addClass('active');

        var picker = $("<div class='colorpicker'></div>");

        var color = app.map.style.background;
        var rgb = { R: color[0] * 255, G: color[1] * 255, B: color[2] * 255 };
        var hsv = Color.RGB_HSV(rgb);
        new Color.Picker({
            hue: hsv.H,
            sat: hsv.S,
            val: hsv.V,
            element: picker[0],
            callback: function(hex) {
                background.find('.color').css('background', '#' + hex);
                app.map.changeBackgroundStyle('#' + hex);            
            }
        });

        background.append(picker);
    });


    var color = app.map.style.background;
    background.find('.color').css('background', 'rgb(' + (color[0] * 255) + ',' + (color[1] * 255) + ',' + (color[2] * 255) + ')');


    for (var i = 0; i < this.map.style.layers.length; i++) {
        var layer = this.map.style.layers[i];
        var bucket = this.map.style.buckets[layer.bucket];

        var item = this.createLayer(layer, bucket);
        $('#layers').append(item);
    }

    $("#add-layer").click(function() {
        // remove all other "new" layers
        $('#layers > .layer.new').remove();

        var header, handle, type, name, remove;
        var item = $('<li class="layer new">')
        .append(header = $('<div class="header">')
            .append(handle = $('<div class="handle">'))
            .append(type = $('<div class="new-icon">'))
            .append(name = $('<div class="name">').text('New Layer'))
            .append(remove = $('<div class="remove">'))
        );

        $('#layers').append(item);

        // Activate this layer.
        app.switchLayer($());
        item.addClass('active');

        remove.click(function() {
            item.remove();
        });


        var bucket_select;
        item.append($('<label>Data: </label>').append(bucket_select = $('<select>')));
        for (var name in app.map.style.buckets) {
            bucket_select.append($('<option>').attr('value', name).text(name));
        }

        item.append('<div class="add-icon">').click(function() {
            var layer = {
                bucket: bucket_select.val(),
                color: "#FF0000"
            };

            var bucket = app.map.style.buckets[layer.bucket];
            switch (bucket.type) {
                case 'fill': layer.antialias = true; break;
                case 'line': layer.width = ["stops", { z: app.map.transform.z, val: 1 }]; break;
            }

            var newItem = app.createLayer(layer, bucket);
            item.after(newItem);
            app.switchLayer(newItem);
            app.updateStyles();
        });
    });
}

App.prototype.updateZoomLevel = function() {
    $('#zoomlevel').text("z" + util.formatNumber(this.map.transform.z + 1, 2));
};

App.prototype.getLayerStyles = function(placeholder, item) {
    var layers = $('#layers > li.layer').map(function(i, layer) {
        if (layer == placeholder) return $(item).data('layer');
        else if (layer == item) return false;
        else return $(layer).data('layer');
    });
    return Array.prototype.slice.call(layers).filter(function(e) { return e; });
};

App.prototype.updateStyles = function(layers) {
    this.map.style.layers = layers || this.getLayerStyles();
    this.map.changeLayerStyles();
};

// source: http://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
function titlecase(str) {
    return str.replace(/\w\S*/g, function(txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}

App.prototype.createLayer = function(layer, bucket) {
    var app = this;
    var handle, type, color, name, remove;
    var header;

    var item = $('<li class="layer">')
        .append(header = $('<div class="header">')
            .append(handle = $('<div class="handle">'))
            .append(type = $('<div>').addClass(bucket.type).attr('title', titlecase(bucket.type)))
            .append(color = $('<div class="color">').css("background", layer.color))
            .append(name = $('<div class="name">').text(layer.bucket))
            .append(remove = $('<div class="remove">'))
        );

    item.data('layer', layer);

    header.click(function() {
        app.switchLayer(item);
    });

    remove.click(function() {
        item.remove();
        app.updateStyles();
    });

    return item;
};

App.prototype.switchLayer = function(item) {
    var app = this;

    var disable = item.is('.active');

    $('.layer.active').each(function(i, item) {
        app.setInactiveLayer($(item));
    });

    if (!disable && item.length) {
        app.setActiveLayer(item);
    }
};

App.prototype.setInactiveLayer = function(item) {
    item.removeClass('active');
    item.children('.colorpicker, .linewidth').remove();
};

App.prototype.setActiveLayer = function(item) {
    // remove all other "new" layers
    $('#layers > .layer.new').remove();

    var app = this;
    item.addClass('active');
    
    var picker = $("<div class='colorpicker'></div>");
    var layer = item.data('layer');


    var hsv = Color.RGB_HSV(css2rgb(layer.color));
    new Color.Picker({
        hue: hsv.H,
        sat: hsv.S,
        val: hsv.V,
        element: picker[0],
        callback: function(hex) {
            layer.color = '#' + hex;
            item.find('.color').css('background', layer.color);
            app.updateStyles();
        }
    });

    item.append(picker);

    var bucket = this.map.style.buckets[layer.bucket];

    if (bucket && bucket.type === 'line') {
        var stops = layer.width.slice(1);
        var widget = new LineWidthWidget(stops);
        widget.on('stops', function(stops) {
            layer.width = ['stops'].concat(stops);
            app.updateStyles();
        });

        this.map.on('zoom', function(e) {
            widget.setPivot(app.map.transform.z + 1);
        });

        widget.setPivot(app.map.transform.z + 1);

        widget.canvas.appendTo(item[0]);
    }

};

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
