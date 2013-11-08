$(function() {
    new App();
});




var util = llmr.util;


function Layer(layer, bucket, app) {
    var self = this;
    this.layer = layer;
    this.bucket = bucket;
    this.app = app;

    this.root = $('<li class="layer">').data('layer', this);
    var header = $('<div class="header">').appendTo(this.root);
    this.body = $('<div class="body">').appendTo(this.root);
    var handle = $('<div class="icon handle-icon">');
    var type = $('<div>').addClass('icon').addClass(bucket.type + '-icon').attr('title', titlecase(bucket.type));
    var color = $('<div class="color">').css("background", layer.color);
    var name = $('<div class="name">');
    var hide = $('<div class="icon hide-icon">');
    var remove = $('<div class="icon remove-icon">');

    if (bucket.type == 'background') {
        this.root.addClass('background');
        name.text('Background');
        header.append(type, color, name);
    } else if (bucket.type == 'new') {
        this.root.addClass('new');
        name.text('New Layer');
        header.append(type, name);
    } else {
        name.text(layer.bucket);
        header.append(handle, type, color, name, remove, hide);
    }

    this.addEffects();

    this.root.click(function() { return false; });
    header.click(this.activate.bind(this));
    remove.click(this.remove.bind(this));
    hide.click(this.hide.bind(this));
}

Layer.prototype.addEffects = function() {
    var self = this;
    this.root.find('.header')
        .mouseenter(function() {
            self.highlight = true;
            $(self).trigger('update');
        })
        .mouseleave(function() {
            self.highlight = false;
            $(self).trigger('update');
        });
};

Layer.prototype.deactivate = function() {
    this.root.removeClass('active');
    this.body.empty();
};

Layer.prototype.activate = function() {
    var self = this;

    if (this.root.is('.active')) {
        this.deactivate();
        return;
    }
    this.root.addClass('active');

    var bucket = this.bucket;
    var layer = this.layer;

    // remove all other "new" layers
    this.root.siblings('.layer.new').remove();
    this.root.siblings('.layer.active').each(function(i, item) {
        $(item).data('layer').deactivate();
    });


    var picker = $("<div class='colorpicker'></div>");
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
    this.body.append(picker);

    if (bucket && bucket.type === 'line') {
        var stops = layer.width.slice(1);
        var widget = new LineWidthWidget(stops);
        widget.on('stops', function(stops) {
            layer.width = ['stops'].concat(stops);
            $(self).trigger('update');
        });

        this.app.map.on('zoom', function(e) {
            widget.setPivot(self.app.map.transform.z + 1);
        });

        widget.setPivot(self.app.map.transform.z + 1);

        widget.canvas.appendTo(this.body[0]);
    }


    return false;
};

Layer.prototype.hide = function() {
    this.hidden = !this.hidden;
    this.root.toggleClass('hidden', this.hidden);
    $(this).trigger('update');
    return false;
};

Layer.prototype.remove = function() {
    this.root.remove();
    $(this).trigger('remove');
};

function NewLayer(layer, bucket, app) {
    Layer.apply(this, arguments);
    this.highlight = true;
}

NewLayer.prototype = Object.create(Layer.prototype);

NewLayer.prototype.addEffects = function() {};

NewLayer.prototype.activate = function() {
    var self = this;
    if (this.root.is('.active')) {
        return;
    }


    this.root.addClass('active');

    var bucket = this.bucket;
    var layer = this.layer;
    var bucket_select;
    self.body.append($('<label>Data: </label>').append(bucket_select = $('<select>')));
    for (var name in this.app.map.style.buckets) {
        bucket_select.append($('<option>').attr('value', name).text(name));
    }

    bucket_select.change(function() {
        layer.bucket = bucket_select.val();
        $(self).trigger('update');
    }).change();

    self.body.append($('<div class="icon add-icon">').click(function() {
        var layer = {
            bucket: bucket = bucket_select.val(),
            color: '#FF0000'
        };

        var bucket = self.app.map.style.buckets[layer.bucket];
        switch (bucket.type) {
            case 'fill': layer.antialias = true; break;
            case 'line': layer.width = ["stops"]; break;
        }

        var item = self.app.createLayer(layer, bucket);
        self.root.after(item.root);
        self.remove();
        item.activate();
        return false;
    }));
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
        items: ".layer:not(.background):not(.new)",
        handle: ".handle-icon",
        cursor: "-webkit-grabbing",
        change: function(e, ui) {
            app.updateStyle(app.getStyles(ui.placeholder[0], ui.item[0]));
        }
    });

    // Background layer
    var item = this.createLayer({ color: to_css_color(app.map.style.background) }, { type: 'background' });
    $('#layers').append(item.root);

    $('#sidebar').click(function() {
        app.deactivateLayers();
        app.updateStyle();
    });

    // Actual layers
    for (var i = 0; i < this.map.style.layers.length; i++) {
        var layer = this.map.style.layers[i];
        var bucket = this.map.style.buckets[layer.bucket];
        var item = this.createLayer(layer, bucket);
        $('#layers').append(item.root);
    }

    $("#add-layer").click(function() {
        var layer = { color: [1, 0, 0, 0], antialias: true, width: 2 };
        var bucket = { type: 'new' };

        var item = new NewLayer(layer, bucket, app);
        $(item).bind('update remove', function() { app.updateStyle(); });
        $('#layers').append(item.root);
        item.activate();
        return false;
    });
}

App.prototype.updateZoomLevel = function() {
    $('#zoomlevel').text("z" + util.formatNumber(this.map.transform.z + 1, 2));
};

App.prototype.createLayer = function(layer, bucket) {
    var app = this;
    var item = new Layer(layer, bucket, this);
    $(item).bind('update remove', function() { app.updateStyle(); });
    return item;
};

App.prototype.deactivateLayers = function() {
    $('#layers > .layer').each(function(i, item) {
        $(item).data('layer').deactivate();
    }).filter('.new').remove();
};

App.prototype.getStyles = function(placeholder, item) {
    var background;
    var layers = [];
    var highlights = [];

    $('#layers > li.layer').each(function(i, layer) {
        if (layer == item) return;
        var data = $(layer == placeholder ? item : layer).data('layer');

        if (data.bucket.type == 'background') {
            background = data.layer.color;
        } else {
            if (!data.hidden) {
                layers.push(data.layer);
            }
            if (data.highlight) {
                highlights.push({ bucket: data.layer.bucket, color: [1, 0, 0, 0.75], antialias: true, width: data.layer.width, pulsating: 1000 });
            }
        }
    });

    return {
        background: background,
        layers: layers.concat(highlights)
    };
};

App.prototype.updateStyle = function(style) {
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
