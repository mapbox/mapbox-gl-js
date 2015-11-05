if (!window.bufferBenchmark) {
    var url = 'http://localhost:6699/bench/buffer?access_token=' + getAccessToken();
    log('red', 'In order to run this benchmark, you must start a different server.');
    log('orange', ' 1) start the buffer benchmark server as <span class="mono">npm run start-buffer</span>');
    log('orange', ' 2) navigate to <a href="' + url + '">http://localhost:6699/bench/buffer</a>');

} else {
    try {
        var evented = bufferBenchmark(getAccessToken());
    } catch (err) {
        log('red', 'Error: ' + err.toString());
        throw err;
    }

    log('dark', 'preloading assets');

    evented.on('start', function(event) {
        log('dark', 'starting first test');
    });

    evented.on('result', function(event) {
        log('blue', formatNumber(event.time) + ' ms');
        scrollToBottom();
    });

    evented.on('end', function(event) {
        log('green', '<strong class="prose-big">' + formatNumber(event.time) + ' ms</strong>');
        scrollToBottom();
    });

    evented.on('error', function(event) {
        log('red', 'Error: ' + event.error);
        scrollToBottom();
    });

}

function scrollToBottom() {
    window.scrollTo(0,document.body.scrollHeight);
}

function log(color, message) {
    document.getElementById('log').innerHTML += '<div class="log dark fill-' + color + '"><p>' + message + '</p></div>';
}

function getAccessToken() {
    var match = location.search.match(/access_token=([^&\/]*)/);
    var accessToken = match && match[1];

    if (accessToken) {
        localStorage.setItem('accessToken', accessToken);
    } else {
        accessToken = localStorage.getItem('accessToken');
    }

    return accessToken;
}

function formatNumber(x) {
    return Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
