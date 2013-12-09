'use strict';

// var util = llmr.util;

var Dropdown = require('./dropdown.js');
var StyleList = require('./stylelist.js');
var DataFilterView = require('./datafilterview.js');
var LayerView = require('./layerview.js');
var defaultStyle = require('./defaultstyle.js');

module.exports = App;
function App() {
    this.layerViews = [];

    this._setupMap();
    this._setupStyleDropdown();
    this._setupAddData();
    this._setupLayers();
    // this._setupXRay();
}

// App.prototype._setupXRay = function() {
//     var app = this;
//     $('.xray-icon').click(function() {
//         var from = +$('#xray').val();
//         var to = from > 0.5 ? 0 : 1;

//         llmr.util.timed(function(t) {
//             var opacity = llmr.util.interp(from, to, util.easeCubicInOut(t));
//             if (app.xRayLayer) {
//                 app.xRayLayer.setOpacity(opacity);
//                 app.style.fire('change');
//             }
//             $('#xray').val(opacity);
//         }, 500);
//     });
//     $('#xray').change(function() {
//         if (app.xRayLayer) {
//             app.xRayLayer.setOpacity(+this.value);
//             app.style.fire('change');
//         }
//     });
// };


App.prototype._setupStyleDropdown = function() {
    var app = this;

    var dropdown = this.dropdown = new Dropdown($('#styles'));

    $('#new-style-template').dialog({
        autoOpen: false,
        modal: true,
        draggable: false,
        title: 'Create New Style',
        width: 350,
        height: 120,
        buttons: [{ text: 'Create', type: 'submit' }],
        open: function(){
            $(this).unbind('submit').submit(function() {
                var name = $(this).find('#new-style-name').val();
                if (name) {
                    list.select(list.create(defaultStyle, name), app.map.animationLoop);
                    $(this).dialog('close');
                }
                return false;
            });
        },
        close: function() {
            $(this).find('#new-style-name').val('');
        }
    });

    $('#add-style').click(function() {
        $('#new-style-template').dialog('open');
    });

    var list = new StyleList();
    list.on('add', function(name) {
        dropdown.add(name.replace(/^llmr\/styles\//, ''), name);
    });
    list.on('change', function(name, style) {
        app.setStyle(style);
        dropdown.select(name);
    });
    list.on('load', function() {
        if (!list.active) {
            $('#new-style-template').dialog('open');
        } else {
            list.select(list.active, app.map.animationLoop);
        }
    });

    $(dropdown)
        .on('item:select', function(e, name) {
            list.select(name, app.map.animationLoop);
        })
        .on('item:remove', function(e, name) {
            list.remove(name);
        });
};

App.prototype._setupMap = function() {
    var app = this;

    window.globalMap = this.map = new llmr.Map({
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
        style: {
            buckets: {},
            structure: []
        }
    });

    this.map.layers.forEach(function(layer) {
        app._setupLayerEvents(layer);
    });

    // Also add event handlers to newly added layers
    this.map.on('layer.add', function(layer) {
        app._setupLayerEvents(layer);
    });

    // this.map.on('click', function(x, y) {
    //     app.map.featuresAt(x, y, { bucket: "__xray__/point/poi_label" }, function(err, features) {
    //         if (err) throw err;
    //         console.warn(features.map(function(feature) { return JSON.stringify(feature); }));
    //     });
    // });


    // this.tooltip = {
    //     root: $('<div id="tooltip"></div>').appendTo('#map'),
    //     icon: $('<div class="sprite-icon dark sprite-icon-triangle-18"></div>').appendTo('#tooltip'),
    //     name: $('<div class="name"></div>').appendTo('#tooltip'),
    //     props: $('<ul class="props"></ul>').appendTo('#tooltip')
    // };

    // this.map.on('hover', function(x, y) {
    //     app.map.featuresAt(x, y, { radius: 8, type: "point" }, function(err, features) {
    //         if (err) throw err;

    //         var feature = features[0];
    //         if (feature) {
    //             app.tooltip.root.addClass('visible');
    //             app.tooltip.icon.removeClass(function (i, css) { return (css.match(/\bsprite-icon-\S+\b/g) || []).join(' '); });

    //             if (feature.maki) {
    //                 app.tooltip.icon.show().addClass('sprite-icon-' + feature.maki + '-18');
    //             } else {
    //                 app.tooltip.icon.hide();
    //             }

    //             app.tooltip.name.text(feature.name);

    //             app.tooltip.props.empty();
    //             for (var key in feature) {
    //                 if (feature.hasOwnProperty(key) && key[0] !== '_') {
    //                     if (key.substr(0, 5) == 'name_' && feature[key] === feature.name) continue;
    //                     app.tooltip.props.append($('<li>').text(key + ': ' + feature[key]));
    //                 }
    //             }

    //             var height = app.tooltip.root.height();
    //             app.tooltip.root.css({ left: (x + 5) + 'px', top: (y - height / 2) + 'px' });
    //         } else {
    //             app.tooltip.root.removeClass("visible");
    //         }
    //     });
    // });

    // this.map.on('hover', function(x, y) {
    //     app.map.featuresAt(x, y, { radius: 2, buckets: true }, function(err, buckets) {
    //         if (err) throw err;

    //         var views = app.layerViews.filter(function(view) {
    //             return buckets.indexOf(view.layer.bucket) >= 0;
    //         });

    //         if (views.length) {
    //             // var data = llmr.util.clone(views[views.length - 1].layer.data);
    //             // data.color = '#FF0000';
    //             // data.pulsating = 1000;
    //             // data.hidden = false;
    //             // newLayer = new llmr.StyleLayer(data, views[views.length - 1].style);
    //             // app.style.highlight(newLayer, views[views.length - 1].bucket);
    //             views[views.length - 1].highlightSidebar(true);
    //         } else {
    //             // app.style.highlight(null, null);
    //         }

    //         app.layerViews.forEach(function(view) {
    //             view.highlightSidebar(views.indexOf(view) >= 0);
    //         });
    //         // console.warn(buckets);
    //     });
    // });

    var zoomlevel = $('#zoomlevel');
    this.map.on('zoom', function() {
        zoomlevel.text('z' + llmr.util.formatNumber(app.map.transform.z + 1, 2));
    }).fire('zoom');


    var compass = $('#compass');
    var arrow = $('.arrow', compass);
    compass.on('click', function() {
        app.map.resetNorth();
    });
    this.map.on('rotation', function() {
        var angle = (app.map.transform.angle / Math.PI * 180) - 90;
        arrow.css('-webkit-transform', 'rotate(' + angle + 'deg)');
        compass.toggleClass('reset', app.map.transform.angle === 0);
    }).fire('rotation');
};

App.prototype._setupLayerEvents = function(layer) {
    var app = this;
    layer.on('tile.load', function() {
        app.updateStats(layer.stats());
    });
    layer.on('tile.remove', function() {
        app.updateStats(layer.stats());
    });
    app.updateStats(layer.stats());
};

App.prototype._setupLayers = function() {
    var app = this;
    var root = $('#layers');
    root.sortable({
        axis: "y",
        items: ".layer:not(.background)",
        handle: ".handle-icon",
        cursor: "-webkit-grabbing",
        change: function(e, ui) {
            var placeholder = ui.placeholder[0];
            var item = ui.item[0];

            var order = [];
            root.find(root.sortable("option", "items")).each(function(i, layer) {
                if (layer == item) return;
                order.push($(layer == placeholder ? item : layer).attr('data-id'));
            });
            app.style.setLayerOrder(order);
        }
    });
};

App.prototype._setupAddData = function() {
    var app = this;

    // Switch between sidebars.
    $('#add-data').click(function() {
        $('.sidebar').removeClass('visible').filter('#data-sidebar').addClass('visible');
        $('#data-sidebar').find('[value=line]').click();
        $('#data-sidebar').find('#add-data-name').val('').attr('placeholder', '<name>');
        $('#data-sidebar').find('.layers input').attr('checked', false);
        $('#data-sidebar').find('.expanded').removeClass('expanded');
    });
    $('#data-sidebar .close-sidebar').click(function() {
        app.style.highlight(null, null);
        $('.sidebar').removeClass('visible').filter('#layer-sidebar').addClass('visible');
    });

    // Expand and collapse the layers.
    $('#data-sidebar')
        .on('click', 'input.source-layer', function() {
            $(this).closest('li.source-layer').siblings().removeClass('expanded');
            $(this).closest('li.source-layer').addClass('expanded');
        })

        .on('click', 'input.feature-name', function() {
            $(this).closest('li.feature-name').siblings().removeClass('expanded');
            $(this).closest('li.feature-name').addClass('expanded')
        });


    this.filter = new DataFilterView($('#data-sidebar .layers'));
    $('#add-data-form').submit(function() {
        var data = app.getDataSelection();

        if (data) {
            if (!data.name) {
                alert("You must enter a name");
                return false;
            }
            if (app.style.buckets[data.name]) {
                alert("This name is already taken");
                return false;
            }

            data.bucket = app.style.addBucket(data.name, data.bucket);
            data.layer = app.style.addLayer(data.layer);

            $('#data-sidebar .close-sidebar').click();
            var view = app.createLayerView(data.layer, data.bucket);
            $('#layers').append(view.root);
            view.activate(data.bucket.type == 'point' ? 'symbol' : 'color');
            app.layerViews.push(view);
        }

        return false;
    });

    // this.filter.on('selection', function() {
    //     if (!app.style) return;

    //     var data = app.getDataSelection();
    //     if (data) {
    //         data.layer.pulsating = 1000;
    //         data.layer.bucket = '__highlight__';
    //         data.layer.color = [1, 0, 0, 0.75];
    //         data.layer.width = 2;
    //         data.layer = new llmr.StyleLayer(data.layer, app.style);
    //         app.style.highlight(data.layer, data.bucket);

    //         $('#add-data-name').attr('placeholder', (data.bucket.value || [data.bucket.layer]).join('+'));
    //     } else {
    //         app.style.highlight(null, null);
    //     }
    // });
};

App.prototype.getDataSelection = function() {
    var name = $('#add-data-name').val() || $('#add-data-name').attr('placeholder');
    var bucket = this.filter.selection();
    var type = $('[name=data-geometry-type]:checked').val();

    if (name == '<name>') name = '';

    if (!bucket || !type) return;

    bucket.type = type;
    var layer = { bucket: name };
    switch (bucket.type) {
        case 'fill': layer.color = '#FF0000'; layer.antialias = true; break;
        case 'line': layer.color = '#00FF00'; layer.width = ["stops"]; break;
        case 'point': layer.image = 'triangle'; layer.imageSize = 12; break;
    }

    return { name: name, layer: layer, bucket: bucket };
};


App.prototype.setStyle = function(style) {
    var app = this;
    this.style = style;
    this.backgroundView = null;
    this.layerViews = [];

    // Enable/Disable the interface
    $('body').toggleClass('no-style-selected', !style);

    $('#layers').empty();

    if (style) {
        // Create X-Ray composite group
        // this.xRayLayer = new llmr.StyleLayer({
        //     type: "composited",
        //     opacity: 0,
        //     layers: []
        // }, style);
        // style.temporaryLayers.push(this.xRayLayer);

        // // Add the background to the X-Ray layer.
        // style.temporaryBuckets['__xray__/background'] = { type: 'background' };
        // this.xRayLayer.layers.push(new llmr.StyleLayer({ bucket: '__xray__/background', color: 'black' }, style));

        this.map.setStyle(style);

        // // Background layer
        // var background_layer = new llmr.StyleLayer({ color: style.background.hex() }, style);
        // background_layer.on('change', function() {
        //     app.style.setBackgroundColor(background_layer.data.color);
        // });


        // var background = this.createLayerView(background_layer, { type: 'background' });
        // $('#layers').append(background.root);
        // this.backgroundView = background;

        // Actual layers
        for (var i = 0; i < style.stylesheet.structure.length; i++) {
            var structure = style.stylesheet.structure[i];
            var view = this.createLayerView(structure.name, structure.bucket, style);
            $('#layers').append(view.root);
            this.layerViews.push(view);
        }
    }
};

App.prototype.createLayerView = function(layer, bucket) {
    var app = this;
    var view = new LayerView(layer, bucket, this.map.style);
    view.on('activate', function() {
        app.layerViews.forEach(function(otherView) {
            if (otherView !== view) {
                otherView.deactivate();
            }
        });
        // if (app.backgroundView !== view) {
        //     app.backgroundView.deactivate();
        // }
    });
    view.on('remove', function() {
        var index = app.layerViews.indexOf(view);
        if (index >= 0) app.layerViews.splice(index, 1);
        view.off();
    });
    return view;
};

App.prototype.updateSprite = function() {
    this.map.style.setSprite(this.style.sprite);
};

// App.prototype.updateXRay = function(stats) {
//     var dirty = false;

//     if (!this.style) {
//         return;
//     }

//     for (var bucket_type in stats) {
//         for (var layer_name in stats[bucket_type]) {
//             var bucket_name = '__xray__/' + bucket_type + '/' + layer_name;

//             if (!this.style.temporaryBuckets[bucket_name]) {
//                 var bucket = { type: bucket_type, layer: layer_name };
//                 var layer = { bucket: bucket_name };
//                 switch (bucket.type) {
//                     case 'fill': layer.color = 'hsla(139, 100%, 40%, 0.2)'; layer.antialias = true; break;
//                     case 'line': layer.color = 'hsla(139, 100%, 40%, 0.2)'; layer.width = ["stops", {z:0,val:1}, {z:14,val:2}, {z:20,val:16}]; break;
//                     case 'point': layer.image = 'marker'; layer.imageSize = 12; layer.invert = true; layer.color = 'hsla(139, 100%, 40%, 0.5)'; break;
//                 }

//                 this.style.temporaryBuckets[bucket_name] = bucket;
//                 this.xRayLayer.layers.push(new llmr.StyleLayer(layer, this.style));
//                 dirty = true;
//             }
//         }
//     }

//     if (dirty) {
//         this.style.fire('buckets');
//         this.style.fire('change');
//     }
// };

App.prototype.updateStats = function(stats) {
    return;
    if (this.filter) {
        this.filter.update(stats);
    }

    // this.updateXRay(stats);

    this.layerViews.forEach(function(view) {
        var count = 0;
        var info = stats[view.bucket.type][view.bucket.layer];

        if (!info) {
            view.setCount(0);
            return;
        }

        if (view.bucket.field) {
            // Count the selected fields
            var field = info[view.bucket.field];
            if (!field) {
                count = 0;
            } else if (Array.isArray(view.bucket.value)) {
                for (var i = 0; i < view.bucket.value.length; i++) {
                    count += field[view.bucket.value[i]] || 0;
                }
            } else {
                count = field[view.bucket.value] || 0;
            }

        } else {
            // Use the entire layer count.
            count = info['(all)'];
        }

        view.setCount(count);
    });
}
