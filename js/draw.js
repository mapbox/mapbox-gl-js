var DEBUG = true;

domready(function() {
    globalMap = new Map(document.getElementById('webgl'), {
        urls: ['/tiles2/{z}/{x}/{y}.vector.pbf'],
        zooms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
        zoom: 0,
        lat: 0,
        lon: 0
    });
});
