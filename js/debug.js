function Debug(map) {
    var gui = new dat.GUI();
    gui.add(map, 'debug').onChange(function() {
        map.rerender();
    });
    gui.add(map, 'resetNorth');
    this.map = map;
}
