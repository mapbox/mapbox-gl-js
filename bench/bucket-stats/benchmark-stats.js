function Benchmark(urls, duration, setup, teardown) {
    RunBenchmark(urls, duration, setup, teardown, done);

    function done(globalResults) {
        document.body.innerHTML = '';
        var settings = document.createElement('div');
        settings.innerHTML = 'duration: ' + duration;
        document.body.appendChild(settings);

        for (var i = 0; i < globalResults.length; i++) {
            var runResults = globalResults[i];
            var mean = Math.round(Benchmark.util.mean(runResults));
            var div = document.createElement('div');
            div.innerHTML = mean + ' ms, ' + runResults.length + ' samples for ' + urls[i];
            document.body.appendChild(div);
        }
    }
}

Benchmark.util = {};

// scales the area covered by the viewport without changing the number of pixels
Benchmark.util.scaleArea = function(id, scale) {
    var container = document.getElementById(id);
    container.style.width = container.offsetWidth * scale;
    container.style.height = container.offsetHeight * scale;
    Benchmark.util.scalePixels(1 / scale);
};

// changes the number of pixels without changing the viewport
Benchmark.util.scalePixels = function(scale) {
    window.devicePixelRatio *= scale;
};

Benchmark.util.mean = function(values) {
    var sum = 0;
    for (var i = 0; i < values.length; i++) {
        sum += values[i];
    }
    return sum / values.length;
};

function RunBenchmark(urls, duration, setup, teardown, done) {

    var queryString = window.location.href.split('?')[1];
    var versionNum = parseInt(queryString && queryString.split('/')[0], 10);
    var base = window.location.href.split('?')[0];

    // make refresh restart
    if (versionNum) {
        var previous = localStorage.getItem('lastVersion');
        if (previous && JSON.parse(previous) === versionNum) {
            versionNum = NaN;
        }
    }
    localStorage.setItem('lastVersion', JSON.stringify(versionNum));

    var endTime;
    var state = {};
    var runResults = [];

    if (versionNum < urls.length) {
        console.log('number', versionNum);
        var url = urls[versionNum];
        var script = document.createElement('script');
        script.src = url;
        document.body.appendChild(script);
        script.onload = setupBenchmark;

    } else if (versionNum) {
        console.log('done');
        done(JSON.parse(localStorage.getItem('results')));

    } else {
        console.log('starting');
        localStorage.setItem('results', JSON.stringify([]));
        next();
    }

    function setupBenchmark() {
        setup(state, function() {
            state.map.on('tile.stats', onTileStats);
            state.map.flyTo({center: [-122.4949, 37.7399], zoom: 11, speed: 0.25});

            setTimeout(function() {
                teardown(state, endBenchmark);
            }, duration);
        });
    }

    function onTileStats(stats) {
        runResults.push(stats._total);
    }

    function endBenchmark() {
        var globalResults = JSON.parse(localStorage.getItem('results'));
        globalResults[versionNum] = runResults;
        localStorage.setItem('results', JSON.stringify(globalResults));
        next();
    }

    function next() {
        var num = isNaN(versionNum) ? 0 : versionNum + 1;
        window.location.href = base + '?' + num;
    }
}
