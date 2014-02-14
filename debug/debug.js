
var gui = new dat.GUI({ autoPlace: false });
document.getElementById('map').appendChild(gui.domElement);
gui.domElement.addEventListener('click', function(ev) { ev.stopPropagation();  }, false);
gui.domElement.addEventListener('dblclick', function(ev) { ev.stopPropagation(); }, false);
gui.domElement.addEventListener('mousedown', function(ev) { ev.stopPropagation(); }, false);

var s = map.style,
    satellite = map.sources.satellite;

var classes = {
    get test() { return s.hasClass('test'); },
    set test(x) { if (x) s.addClass('test'); else s.removeClass('test'); },

    get satellite() { return s.hasClass('satellite'); },
    set satellite(x) {
        if (x) {
            s.addClass('satellite');
        } else {
            s.removeClass('satellite');
        }
    },
};

gui.add(map, 'debug').name('Statistics');
gui.add(map, 'repaint').name('Repaint');
gui.add(map, 'antialiasing').name('Antialiasing');
gui.add(map, 'vertices').name('Show Vertices');
gui.add(classes, 'satellite').name('Satellite');
gui.add(classes, 'test').name('Streets');
gui.add(map, 'loadNewTiles').name('Load Tiles');
gui.add(map, 'resetNorth').name('Reset North');

function rerender() {
    map.style.cascade();
    map._updateStyle();
    map._rerender();
}

function addColors(map, style) {
    var colors = gui.addFolder('Colors');
    var stylesheet = map.style.stylesheet;
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
