var util = llmr.util;

function App() {
    var app = this;

    var dropdown = this.dropdown = new Dropdown($('#styles'));

    $("#new-style-template").dialog({
        autoOpen: false,
        modal: true,
        draggable: false,
        title: "Create New Style",
        width: 350,
        height: 120,
        buttons: [{ text: "Create", type: "submit" }],
        open: function(){
            $(this).unbind('submit').submit(function() {
                var name = $(this).find('#new-style-name').val();
                if (name) {
                    list.select(list.create(defaultStyle, name));
                    $(this).dialog("close");
                }
                return false;
            });
        },
        close: function() {
            $(this).find('#new-style-name').val("");
        }
    });

    $('#add-style').click(function() {
        $("#new-style-template").dialog("open");
    });


    var list = this.list = new StyleList();
    $(list)
        .on('style:add', function(e, name) {
            dropdown.add(name.replace(/^llmr\/styles\//, ''), name);
        })
        .on('style:change', function(e, data) {
            app.map.switchStyle(data.style);
            dropdown.select(data.name);
            app.createLayers();
        })
        .on('style:load', function() {
            if (!list.active) {
                $("#new-style-template").dialog("open");
            } else {
                list.select(list.active);
            }
        });

    $(dropdown)
        .on('item:select', function(e, name) {
            list.select(name);
        })
        .on('item:remove', function(e, name) {
            list.remove(name);
        });


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
        style: {}
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

    $('body').click(function() {
        app.deactivateLayers();
        app.updateStyle();
    });

    $("#add-layer").click(function() {
        var layer = { color: [1, 0, 0, 0], antialias: true, width: 2 };
        var bucket = { type: 'new' };

        var item = new NewLayer(layer, bucket, app);
        $(item).bind('update remove', function() { app.updateStyle(); });
        $('#layers').append(item.root);
        item.activate();
        return false;
    });

    $('#sidebar, #map').hide();
}

App.prototype.createLayers = function() {
    var app = this;

    $('#layers').empty();

    if (app.list.active) {
        $('#sidebar, #map').show();
        // Background layer
        var item = this.createLayer({ color: to_css_color(app.map.style.background) }, { type: 'background' });
        $('#layers').append(item.root);

        // Actual layers
        for (var i = 0; i < this.map.style.layers.length; i++) {
            var layer = this.map.style.layers[i];
            var bucket = this.map.style.buckets[layer.bucket];
            var item = this.createLayer(layer, bucket);
            $('#layers').append(item.root);
        }
    } else {
        $('#sidebar, #map').hide();
    }
};

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
    }).filter('.new').each(function(i, item) {
        $(item).data('layer').remove();
    });
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
            layers.push(data.layer);
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

    var storeStyle = {
        buckets: this.map.style.buckets,
        layers: []
    };

    $('#layers > li.layer').each(function(i, layer) {
        var data = $(layer).data('layer');
        if (data.bucket.type == 'background') {
            storeStyle.background = data.layer.color;
        } else {
            storeStyle.layers.push(data.layer);
        }
    });

    this.list.save(storeStyle);
};
