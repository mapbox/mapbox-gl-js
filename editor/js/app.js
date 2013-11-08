$(function() {
    new App();
});




var util = llmr.util;


function Layer(layer, bucket, map) {
    this.layer = layer;
    this.bucket = bucket;
    this.map = map;

    this.root = $('<li class="layer">').data('layer', this);
    var header = $('<div class="header">').appendTo(this.root);
    var handle = $('<div class="icon handle-icon">');
    var type = $('<div>').addClass('icon').addClass(bucket.type + '-icon').attr('title', titlecase(bucket.type));
    var color = $('<div class="color">').css("background", layer.color);
    var name = $('<div class="name">');
    var remove = $('<div class="icon remove-icon">');

    if (bucket.type == 'background') {
        this.root.addClass('background');
        name.text('Background');
        header.append(type, color, name);
    } else {
        name.text(layer.bucket);
        header.append(handle, type, color, name, remove);
    }

    header.click(this.activate.bind(this));
    remove.click(this.remove.bind(this));
}

Layer.prototype.deactivate = function() {
    this.root.removeClass('active');
    this.root.find('.colorpicker').remove();
    this.root.find('.linewidth').remove();
};

Layer.prototype.activate = function() {
    var self = this;

    if (this.root.is('.active')) {
        this.deactivate();
        return;
    }

    // remove all other "new" layers
    this.root.siblings('.layer.new').remove();
    this.root.siblings('.layer.active').each(function(i, item) {
        $(item).data('layer').deactivate();
    });

    this.root.addClass('active');

    var picker = $("<div class='colorpicker'></div>");
    var layer = this.layer;


    var hsv = Color.RGB_HSV(css2rgb(layer.color));
    new Color.Picker({
        hue: hsv.H,
        sat: hsv.S,
        val: hsv.V,
        element: picker[0],
        callback: function(hex) {
            layer.color = '#' + hex;
            self.root.find('.color').css('background', layer.color);
            $(self).trigger('update');
        }
    });

    this.root.append(picker);

    var bucket = this.bucket;

    if (bucket && bucket.type === 'line') {
        var stops = layer.width.slice(1);
        var widget = new LineWidthWidget(stops);
        widget.on('stops', function(stops) {
            layer.width = ['stops'].concat(stops);
            $(self).trigger('update');
        });

        this.map.on('zoom', function(e) {
            widget.setPivot(self.map.transform.z + 1);
        });

        widget.setPivot(self.map.transform.z + 1);

        widget.canvas.appendTo(this.root[0]);
    }

};

Layer.prototype.remove = function() {
    this.root.remove();
    $(this).trigger('remove');
};

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
        items: ".layer:not(.background)",
        handle: ".handle-icon",
        cursor: "-webkit-grabbing",
        change: function(e, ui) {
            app.updateStyles(app.getStyles(ui.placeholder[0], ui.item[0]));
        }
    });

    // Background layer
    this.createLayer({ color: to_css_color(app.map.style.background) }, { type: 'background' });

    // Actual layers
    for (var i = 0; i < this.map.style.layers.length; i++) {
        var layer = this.map.style.layers[i];
        var bucket = this.map.style.buckets[layer.bucket];
        this.createLayer(layer, bucket);
    }

    $("#add-layer").click(function() {
        // remove all other "new" layers
        $('#layers > .layer.new').remove();

        var header, handle, type, name, remove;
        var item = $('<li class="layer new">')
        .append(header = $('<div class="header">')
            .append(handle = $('<div class="icon handle-icon">'))
            .append(type = $('<div class="icon new-icon">'))
            .append(name = $('<div class="name">').text('New Layer'))
            .append(remove = $('<div class="icon remove-icon">'))
        );

        // Deactivate all other layers.
        $('#layers > .layer').each(function(i, layer) {
            $(layer).data('layer').deactivate();
        });

        $('#layers').append(item);

        item.addClass('active');

        remove.click(function() {
            item.remove();
        });


        var bucket_select;
        item.append($('<label>Data: </label>').append(bucket_select = $('<select>')));
        for (var name in app.map.style.buckets) {
            bucket_select.append($('<option>').attr('value', name).text(name));
        }

        item.append('<div class="icon add-icon">').click(function() {
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
            newItem.activate();
            app.updateStyles();
        });
    });
}

App.prototype.updateZoomLevel = function() {
    $('#zoomlevel').text("z" + util.formatNumber(this.map.transform.z + 1, 2));
};

App.prototype.getStyles = function(placeholder, item) {
    var background;
    var layers = $('#layers > li.layer').map(function(i, layer) {
        if (layer == item) return;
        var data = $(layer == placeholder ? item : layer).data('layer');

        if (data.bucket.type == 'background') {
            background = data.layer;
        } else {
            return data.layer;
        }
    });
    return {
        background: background.color,
        layers: Array.prototype.slice.call(layers).filter(function(e) { return e; })
    };
};

App.prototype.createLayer = function(layer, bucket) {
    var app = this;
    var item = new Layer(layer, bucket, this.map);
    $('#layers').append(item.root);
    $(item).bind('update remove', function() { app.updateStyles(); });
    return item;
};

App.prototype.updateStyles = function(style) {
    if (!style) style = this.getStyles();
    this.map.style.layers = style.layers;
    this.map.changeBackgroundStyle(style.background);
    this.map.changeLayerStyles();
};

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
