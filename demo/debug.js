
function Debug(map) {
    "use strict";

    var gui = new dat.GUI({ autoPlace: false });
    document.getElementById('map').appendChild(gui.domElement);
    gui.domElement.addEventListener('click', function(ev) { ev.stopPropagation();  }, false);
    gui.domElement.addEventListener('dblclick', function(ev) { ev.stopPropagation(); }, false);
    gui.domElement.addEventListener('mousedown', function(ev) { ev.stopPropagation(); }, false);

    // was hitting this unresolved bug with dat.remember(), so doing it ourselves
    // https://code.google.com/p/dat-gui/issues/detail?id=13
    var props = ['debug', 'repaint', 'antialiasing', 'vertices', 'satellite', 'loadNewTiles'];

    /*
    var settings = window.localStorage.getItem('mapsettings');
    if (settings) {
        settings = JSON.parse(settings);
        for (var i in settings) { map[i] = settings[i]; }
    }

    window.onbeforeunload = function() {
        settings = {};
        props.forEach(function(d) { settings[d] = map[d]; });
        window.localStorage.setItem('mapsettings', JSON.stringify(settings));
    };
    */

    var s = map.style;

    var changeSatellite;

    var classes = {
        get test() { return s.hasClass('test'); },
        set test(x) { if (x) s.addClass('test'); else s.removeClass('test'); },
        get satellite() { return s.hasClass('satellite'); },
        set satellite(x) { 
            if (x) s.addClass('satellite');
            else s.removeClass('satellite');
            if (x) map.satellite = x;
            window.clearTimeout(changeSatellite);
            window.setTimeout(function() { map.satellite = x; }, 1000);
        },
    };

    /*
    gui.add(map, 'debug').name('Statistics');
    gui.add(map, 'repaint').name('Repaint');
    gui.add(map, 'antialiasing').name('Antialiasing');
    gui.add(map, 'vertices').name('Show Vertices');
    gui.add(classes, 'satellite').name('Satellite');
    gui.add(classes, 'test').name('Streets');
    gui.add(map, 'loadNewTiles').name('Load Tiles');
    */

    function rerender() {
        map._updateStyle();
        map._rerender();
    }

    function addColors(map, style) {
        var colors = gui.addFolder('Colors');
        var stylesheet = map.style.stylesheet;
        colors.add(map, 'resetNorth').name('Reset North');
        colors.add(stylesheet.constants, 'satellite_brightness_low', 0, 1).name('Low').onChange(rerender);
        colors.add(stylesheet.constants, 'satellite_brightness_high', 0, 1).name('High').onChange(rerender);
        colors.add(stylesheet.constants, 'satellite_saturation', 0, 4).name('Saturation').onChange(rerender);
        colors.add(stylesheet.constants, 'satellite_spin', 0, Math.PI * 2).name('Spin').onChange(rerender);
        colors.addColor(stylesheet.constants, 'land').name('Land').onChange(rerender);
        colors.addColor(stylesheet.constants, 'water').name('Water').onChange(rerender);
        colors.addColor(stylesheet.constants, 'park').name('Park').onChange(rerender);
        colors.addColor(stylesheet.constants, 'road').name('Road').onChange(rerender);
        colors.addColor(stylesheet.constants, 'border').name('Border').onChange(rerender);
        colors.addColor(stylesheet.constants, 'building').name('Building').onChange(rerender);
        colors.addColor(stylesheet.constants, 'wood').name('Wood').onChange(rerender);
        colors.addColor(stylesheet.constants, 'text').name('Text').onChange(rerender);
        //colors.open();
    }

    addColors(map);


    var tabs = d3.selectAll('#classtabs a');

    var unsetSatellite;
    tabs.on('click', function() {
        var $this = d3.select(this);
        tabs.classed('active', false);
        $this.classed('active', true);
        map.style.setClassList($this.attr('id').split('-'));
        d3.event.stopPropagation();
        d3.event.preventDefault();

        var satellite = $this.attr('id').indexOf('satellite') >= 0;

        window.clearTimeout(unsetSatellite);
        if (satellite) {
            map.satellite = true;
        } else {
            unsetSatellite = window.setTimeout(function() {
                map.satellite = false;
            }, 1000);
        }


        /*
        var dark = $this.attr('id').indexOf('dark') >= 0;
        d3.select('#controls').classed('fill-darken3', dark);
        d3.select('#controls').classed('dark', dark);
        */
    });

}
