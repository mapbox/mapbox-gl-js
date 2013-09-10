function Debug(map) {
    var gui = new dat.GUI({ autoPlace: false });
    document.getElementById('map').appendChild(gui.domElement);
    gui.domElement.addEventListener("click", function(ev) { ev.stopPropagation();  }, false);
    gui.domElement.addEventListener("dblclick", function(ev) { ev.stopPropagation(); }, false);
    gui.domElement.addEventListener("mousedown", function(ev) { ev.stopPropagation(); }, false);

    gui.add(map, 'debug').name('Statistics');
    gui.add(map, 'repaint').name('Repaint');
    gui.add(map, 'antialiasing').name('Antialiasing');
    gui.add(map, 'vertices').name('Show Vertices');
    gui.add(map, 'resetNorth').name('Reset North');
    gui.add(map.transform, 'lat').name('Latitude').min(-85).max(85).step(0.01).listen();
    gui.add(map.transform, 'lon').name('Longitude').min(-180).max(180).step(0.01).listen();
    // gui.add(map.transform, 'zoom').min(0).max(24).listen();

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
