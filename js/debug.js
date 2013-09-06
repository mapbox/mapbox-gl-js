function Debug(map) {
    var gui = new dat.GUI({ autoPlace: false });
    document.getElementById('map').appendChild(gui.domElement);
    gui.domElement.addEventListener("click", function(ev) { ev.stopPropagation();  }, false);
    gui.domElement.addEventListener("dblclick", function(ev) { ev.stopPropagation(); }, false);

    gui.add(map, 'debug').name('Tile Borders');
    gui.add(map, 'repaint').name('Repaint');
    gui.add(map, 'antialiasing').name('Antialiasing');
    gui.add(map, 'resetNorth').name('Reset North');
    gui.add(map.transform, 'lat').name('Latitude').min(-85).max(85).step(0.01).listen();
    gui.add(map.transform, 'lon').name('Longitude').min(-180).max(180).step(0.01).listen();
    // gui.add(map.transform, 'zoom').min(0).max(24).listen();
}
