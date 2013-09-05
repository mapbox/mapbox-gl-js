function Debug(map) {
    var gui = new dat.GUI();
    gui.add(map, 'debug').onChange(function() {
        map.rerender();
    });
    gui.add(map, 'resetNorth');
    gui.add(map.transform, 'lat').min(-90).max(90).listen();
    gui.add(map.transform, 'lon').min(-180).max(180).listen();
    gui.add(map.transform, 'zoom').min(0).max(24).listen();
    this.map = map;
}
