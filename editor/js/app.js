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


    var map = this.map = new llmr.Map({
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

    var datafilter = new DataFilterView($('#data-sidebar .layers'));


    function updateStats(stats) {
        datafilter.update(stats);

        $('#layers > li.layer').each(function(i, layer) {
            var data = $(layer).data('layer');

            var count = 0;
            var info = stats[data.bucket.layer];

            if (!info) return;

            if (data.bucket.field) {
                var field = info[data.bucket.field];
                if (Array.isArray(data.bucket.value)) {
                    for (var i = 0; i < data.bucket.value.length; i++) {
                        count += field[data.bucket.value[i]] || 0;
                    }
                } else {
                    count = field[data.bucket.value] || 0;
                }

            } else {
                count = info['(all)'];
            }

            data.setCount(count);
            // console.warn(data.layer.bucket);
            // console.warn(stats);
            // var info = stats[data.layer.bucket];
            // console.warn(info);
        });
    }


    map.on('layer.add', function(layer) {
        layer.on('tile.load.sidebar tile.remove.sidebar', function() {
            updateStats(layer.stats());
        });
        updateStats(layer.stats());
    });


    $('#add-data').click(function() {
        $('.sidebar').removeClass('visible').filter('#data-sidebar').addClass('visible');
    });


    $('#data-sidebar .close-sidebar').click(function() {
        $('.sidebar').removeClass('visible').filter('#layer-sidebar').addClass('visible');

        // map.layers.forEach(function(layer) {
        //     layer.off('tile.sidebar');
        // });
    });


    $('#data-sidebar')
        .on('click', 'input.source-layer', function() {
            $(this).closest('li.source-layer').siblings().removeClass('expanded');
            $(this).closest('li.source-layer').addClass('expanded');
        })

        .on('click', 'input.feature-name', function() {
            $(this).closest('li.feature-name').siblings().removeClass('expanded');
            $(this).closest('li.feature-name').addClass('expanded')
        });

    $('#add-data-form').submit(function() {
        var name = $('#add-data-name').val();
        var bucket = datafilter.selection();
        var type = $('[name=data-geometry-type]:checked').val();

        if (name && bucket && type) {
            if (map.style.buckets[name]) {
                alert("This name is already taken");
                return false;
            }

            $('#data-sidebar .close-sidebar').click();

            bucket.type = type;
            map.style.buckets[name] = bucket;
            map._updateBuckets();

            var layer = {
                bucket: name,
                color: '#FF0000'
            };

            switch (bucket.type) {
                case 'fill': layer.antialias = true; break;
                case 'line': layer.width = ["stops"]; break;
            }

            var item = app.createLayer(layer, bucket);
            $('#layers').append(item.root);
            item.activate();
        }

        return false;
    });

    // $('#sidebar, #map').hide();
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
        // $('#sidebar, #map').hide();
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
