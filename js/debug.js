function Debug(map) {
    var gui = new dat.GUI({ autoPlace: false });
    document.getElementById('map').appendChild(gui.domElement);
    gui.domElement.addEventListener("click", function(ev) { ev.stopPropagation();  }, false);
    gui.domElement.addEventListener("dblclick", function(ev) { ev.stopPropagation(); }, false);
    gui.domElement.addEventListener("mousedown", function(ev) { ev.stopPropagation(); }, false);

    // was hitting this unresolved bug with dat.remember(), so doing it ourselves
    // https://code.google.com/p/dat-gui/issues/detail?id=13
    var props = ['debug', 'repaint', 'antialiasing', 'vertices', 'satellite', 'loadNewTiles'];

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

    var styles = [style_json, style_json2];
    var style = 0;
    var switchStyle = {
        switchStyle: function() {
            style++;
            map.switchStyle(styles[style % styles.length]);
        }
    };

    gui.add(map, 'debug').name('Statistics');
    gui.add(map, 'repaint').name('Repaint');
    gui.add(map, 'antialiasing').name('Antialiasing');
    gui.add(map, 'vertices').name('Show Vertices');
    gui.add(map, 'satellite').name('Satellite');
    gui.add(map, 'loadNewTiles').name('Load Tiles');
    gui.add(map, 'resetNorth').name('Reset North');
    gui.add(switchStyle, 'switchStyle').name('Swap style');


    function rerender() {
        map._updateStyle();
        map._rerender();
    }

    var colors = gui.addFolder('Colors');
    colors.addColor(map.style.constants, 'land').name('Land').onChange(rerender);
    colors.addColor(map.style.constants, 'water').name('Water').onChange(rerender);
    colors.addColor(map.style.constants, 'park').name('Park').onChange(rerender);
    colors.addColor(map.style.constants, 'road').name('Road').onChange(rerender);
    colors.addColor(map.style.constants, 'border').name('Border').onChange(rerender);
    colors.addColor(map.style.constants, 'wood').name('Wood').onChange(rerender);
    colors.addColor(map.style.constants, 'text').name('Text').onChange(rerender);
    colors.open();
}
