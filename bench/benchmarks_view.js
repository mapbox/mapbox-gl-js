'use strict';
/*eslint no-unused-vars: ["error", { "varsIgnorePattern": "BenchmarksView|clipboard" }]*/

var Clipboard = require('clipboard');

var BenchmarksView = React.createClass({

    render: function() {
        return <div style={{width: 960, paddingBottom: window.innerHeight, margin: '0 auto'}}>
            {this.renderSidebarBenchmarks()}
            {this.renderBenchmarks()}
        </div>;
    },

    renderSidebarBenchmarks: function() {
        return <div style={{paddingTop: 40, width: 280, position: 'fixed'}} className='text-right'>
            <h1 className="space-bottom">Benchmarks</h1>
            <div className="space-bottom small">
                {Object.keys(this.state.results).map(this.renderSidebarBenchmark)}
            </div>
            <a
                    className={[
                        'icon',
                        'clipboard',
                        'button',
                        (this.getStatus() === 'ended' ? '' : 'disabled')
                    ].join(' ')}
                    data-clipboard-text={this.renderTextBenchmarks()}>
                Copy Results
            </a>
        </div>;
    },

    renderSidebarBenchmark: function(name) {
        return <div
                key={name}
                className={[
                    'space-bottom',
                    this.getBenchmarkStatus(name) === 'waiting' ? 'quiet' : ''
                ].join(' ')}>
            <h3>{name}</h3>
            {Object.keys(this.state.results[name]).map(this.renderSidebarBenchmarkVersion.bind(this, name))}
        </div>;
    },

    renderSidebarBenchmarkVersion: function(name, version) {
        var results = this.state.results[name][version];
        var that = this;

        return <div
                onClick={function() {
                    that.scrollToBenchmark(name, version);
                }}
                style={{cursor: 'pointer'}}
                key={version}
                className={results.status === 'waiting' ? 'quiet' : ''}>
            <strong>{version}:</strong> {results.message || '...'}
        </div>;
    },

    renderTextBenchmarks: function() {
        var output = '# Benchmarks\n';
        for (var name in this.state.results) {
            output += '\n## ' + name + '\n\n';
            for (var version in this.state.results[name]) {
                var result = this.state.results[name][version];
                output += '**' + version + ':** ' + (result.message || '...') + '\n';
            }
        }
        return output;
    },

    renderBenchmarks: function() {
        return <div style={{width: 590, marginLeft: 320, marginBottom: 60}}>
            {Object.keys(this.state.results).map(this.renderBenchmark)}
        </div>;
    },

    renderBenchmark: function(name) {
        return <div key={name}>
            {Object.keys(this.state.results[name]).map(this.renderBenchmarkVersion.bind(this, name))}
        </div>;
    },

    renderBenchmarkVersion: function(name, version) {
        var results = this.state.results[name][version];
        return (
                <div
                    style={{paddingTop: 40}}
                    id={name + version}
                    key={version}
                    className={results.status === 'waiting' ? 'quiet' : ''}>

                    <h2 className='space-bottom'>{name} on {version}</h2>
                {results.logs.map(function(log, index) {
                    return <div key={index} className={'pad1 dark fill-' + log.color}>{log.message}</div>;
                })}
            </div>
        );
    },

    scrollToBenchmark: function(name, version) {
        var duration = 300;
        var startTime = (new Date()).getTime();
        var startYOffset = window.pageYOffset;

        requestAnimationFrame(function frame() {
            var endYOffset = document.getElementById(name + version).offsetTop;
            var time = (new Date()).getTime();
            var yOffset = Math.min((time - startTime) / duration, 1) * (endYOffset - startYOffset) + startYOffset;
            window.scrollTo(0, yOffset);
            if (time < startTime + duration) requestAnimationFrame(frame);
        });
    },

    getInitialState: function() {
        var results = {};

        for (var name in this.props.benchmarks) {
            for (var version in this.props.benchmarks[name]) {
                if (!this.props.benchmarkFilter || this.props.benchmarkFilter(name, version)) {
                    results[name] = results[name] || {};
                    results[name][version] = {
                        status: 'waiting',
                        logs: []
                    };
                }
            }
        }

        return { results: results };
    },

    componentDidMount: function() {
        var that = this;

        asyncSeries(Object.keys(that.state.results), function(name, callback) {
            asyncSeries(Object.keys(that.state.results[name]), function(version, callback) {
                that.scrollToBenchmark(name, version);
                that.runBenchmark(name, version, callback);
            }, callback);
        });
    },

    runBenchmark: function(name, version, outerCallback) {
        var that = this;
        var results = this.state.results[name][version];

        results.status = 'running';
        this.scrollToBenchmark(name, version);
        log('dark', 'starting');

        var emitter = this.props.benchmarks[name][version]();

        emitter.on('log', function(event) {
            log(event.color, event.message);

        });

        emitter.on('end', function(event) {
            results.message = event.message;
            results.status = 'ended';
            log('green', event.message);
            callback();

        });

        emitter.on('error', function(event) {
            results.status = 'errored';
            log('red', event.error);
            callback();
        });

        function log(color, message) {
            results.logs.push({
                color: color || 'blue',
                message: message
            });
            that.forceUpdate();
        }

        function callback() {
            setTimeout(outerCallback, 500);
        }
    },

    getBenchmarkVersionStatus: function(name, version) {
        return this.state.results[name][version].status;
    },

    getBenchmarkStatus: function(name) {
        return reduceStatuses(Object.keys(this.state.results[name]).map(function(version) {
            return this.getBenchmarkVersionStatus(name, version);
        }, this));
    },

    getStatus() {
        return reduceStatuses(Object.keys(this.state.results).map(function(name) {
            return this.getBenchmarkStatus(name);
        }, this));
    }
});

function reduceStatuses(statuses) {
    if (statuses.indexOf('running') !== -1) {
        return 'running';
    } else if (statuses.indexOf('waiting') !== -1) {
        return 'waiting';
    } else {
        return 'ended';
    }
}

var clipboard = new Clipboard('.clipboard');

ReactDOM.render(
    <BenchmarksView
        benchmarks={window.mapboxglBenchmarks}
        benchmarkFilter={function(name) {
            var nameFilter = window.location.hash.substr(1);
            return !nameFilter || name === nameFilter;
        }}
    />,
    document.getElementById('benchmarks')
);

function asyncSeries(array, iterator, callback) {
    if (array.length) {
        iterator(array[0], function(err) {
            if (err) callback(err);
            else asyncSeries(array.slice(1), iterator, callback);
        });
    } else {
        callback();
    }
}
