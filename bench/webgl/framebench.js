function FrameBench(urls, duration, setup, teardown) {

    this.urls = urls;
    this.duration = duration;
    this.setup = setup;
    this.teardown = teardown;
    this.versions = [];
    var bench = this;

    var name = this.name = 'mapboxgl';

    if (window.versions === undefined) window.versions = {};
    window.versions[name] = [];


    var i = -1;

    next();

    function next() {
        if (i >=0) bench.versions[i] = window[name];
        i++;
        if (urls[i]) {
            var script = document.createElement('script');
            script.src = urls[i];
            document.body.appendChild(script);
            script.onload = next;
        } else {
            done();
        }
    }

    function done() {
        // all the scripts have been loaded
        bench.ready = true;
        if (bench.onready) bench.onready();
    }
}

FrameBench.prototype.run = function(complete) {

    var bench = this;

    if (!this.ready) {
        this.onready = function() {
            bench.run(complete);
        };
        return;
    }

    var version = -1;

    var versions = this.versions;

    var frames = [];
    for (var k = 0; k < versions.length; k++) frames[k] = [];

    var endTime;
    var state;

    next();

    function next() {
        version++;
        if (versions[version]) {
            bench.setup(versions[version], run);
        } else {
            complete(frames);
        }
    }

    function run(_state) {
        state = _state;
        endTime = Date.now() + bench.duration;
        window.requestAnimationFrame(onFrame);
    }

    function onFrame() {
        var now = Date.now();

        frames[version].push(now);

        if (now < endTime) {
            window.requestAnimationFrame(onFrame);
        } else {
            bench.teardown(state, next);
        }
    }
};
