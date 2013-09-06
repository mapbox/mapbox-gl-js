function Debug(map) {
    var gui = new dat.GUI({ autoPlace: false });
    document.getElementById('map').appendChild(gui.domElement);

    gui.add(map, 'debug');
    gui.add(map, 'repaint');
    gui.add(map, 'resetNorth');
    gui.add(map.transform, 'lat').min(-85).max(85).step(0.01).listen();
    gui.add(map.transform, 'lon').min(-180).max(180).step(0.01).listen();
    // gui.add(map.transform, 'zoom').min(0).max(24).listen();
}
