'use strict';

function Benchmark(urls, duration, setup, teardown) {
    runBenchmark(urls, duration, setup, teardown, done);

    function done(frames) {
        document.body.innerHTML = '';
        var settings = document.createElement('div');
        settings.innerHTML = 'duration: ' + duration;
        document.body.appendChild(settings);

        for (var i = 0; i < frames.length; i++) {
            var fps = Benchmark.util.mean(frames[i]);
            fps = Math.round(fps * 10) / 10;
            var div = document.createElement('div');
            div.innerHTML = fps + ' fps ' + urls[i];
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

Benchmark.util.mean = function(frames) {
    return (frames.length - 1) * 1000 / (frames[frames.length - 1] - frames[0]);
};

function runBenchmark(urls, duration, setup, teardown, done) {

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
    var frames = [];

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
            endTime = performance.now() + duration;
            window.requestAnimationFrame(onFrame);
        });
    }

    function onFrame() {
        var now = performance.now();

        frames.push(now);

        if (now < endTime) {
            window.requestAnimationFrame(onFrame);
        } else {
            teardown(state, endBenchmark);
        }
    }

    function endBenchmark() {
        var results = JSON.parse(localStorage.getItem('results'));
        results[versionNum] = frames;
        localStorage.setItem('results', JSON.stringify(results));
        next();
    }

    function next() {
        var num = isNaN(versionNum) ? 0 : versionNum + 1;
        window.location.href = base + '?' + num;
    }
}
