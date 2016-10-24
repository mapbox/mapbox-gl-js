'use strict';
/*eslint no-unused-vars: ["error", { "varsIgnorePattern": "BenchmarksView|clipboard" }]*/

const Clipboard = require('clipboard');

// Benchmark results seem to be more consistent with a warmup and cooldown
// period. These values are measured in milliseconds.
const benchmarkCooldownTime = 250;
const benchmarkWarmupTime  = 250;

const BenchmarksView = React.createClass({

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
        const results = this.state.results[name][version];
        const that = this;

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
        const versions = [];
        for (const name in this.state.results) {
            for (const version in this.state.results[name]) {
                if (versions.indexOf(version) < 0) {
                    versions.push(version);
                }
            }
        }

        let output = `benchmark | ${versions.join(' | ')}\n---`;
        for (let i = 0; i < versions.length; i++) {
            output += ' | ---';
        }
        output += '\n';

        for (const name in this.state.results) {
            output += `**${name}**`;
            for (const version of versions) {
                const result = this.state.results[name][version];
                output += ` | ${result && result.message || 'n\/a'} `;
            }
            output += '\n';
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
        const results = this.state.results[name][version];
        return (
                <div
                    style={{paddingTop: 40}}
                    id={name + version}
                    key={version}
                    className={results.status === 'waiting' ? 'quiet' : ''}>

                    <h2 className='space-bottom'>{name} on {version}</h2>
                {results.logs.map((log, index) => {
                    return <div key={index} className={`pad1 dark fill-${log.color}`}>{log.message}</div>;
                })}
            </div>
        );
    },

    scrollToBenchmark: function(name, version) {
        const duration = 300;
        const startTime = (new Date()).getTime();
        const startYOffset = window.pageYOffset;

        requestAnimationFrame(function frame() {
            const endYOffset = document.getElementById(name + version).offsetTop;
            const time = (new Date()).getTime();
            const yOffset = Math.min((time - startTime) / duration, 1) * (endYOffset - startYOffset) + startYOffset;
            window.scrollTo(0, yOffset);
            if (time < startTime + duration) requestAnimationFrame(frame);
        });
    },

    getInitialState: function() {
        const results = {};

        for (const name in this.props.benchmarks) {
            for (const version in this.props.benchmarks[name]) {
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
        const that = this;

        asyncSeries(Object.keys(that.state.results), (name, callback) => {
            asyncSeries(Object.keys(that.state.results[name]), (version, callback) => {
                that.scrollToBenchmark(name, version);
                that.runBenchmark(name, version, callback);
            }, callback);
        }, (err) => {
            if (err) throw err;
        });
    },

    runBenchmark: function(name, version, outerCallback) {
        const that = this;
        const results = this.state.results[name][version];

        function log(color, message) {
            results.logs.push({
                color: color || 'blue',
                message: message
            });
            that.forceUpdate();
        }

        function callback() {
            setTimeout(outerCallback, benchmarkCooldownTime);
        }

        results.status = 'running';
        this.scrollToBenchmark(name, version);
        log('dark', 'starting');

        setTimeout(() => {
            const emitter = that.props.benchmarks[name][version]();

            emitter.on('log', (event) => {
                log(event.color, event.message);

            });

            emitter.on('end', (event) => {
                results.message = event.message;
                results.status = 'ended';
                log('green', event.message);
                callback();

            });

            emitter.on('error', (event) => {
                results.status = 'errored';
                log('red', event.error);
                callback();
            });

        }, benchmarkWarmupTime);
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

const clipboard = new Clipboard('.clipboard');

ReactDOM.render(
    <BenchmarksView
        benchmarks={window.mapboxglBenchmarks}
        benchmarkFilter={function(name) {
            const nameFilter = window.location.hash.substr(1);
            return !nameFilter || name === nameFilter;
        }}
    />,
    document.getElementById('benchmarks')
);

function asyncSeries(array, iterator, callback) {
    if (array.length) {
        iterator(array[0], (err) => {
            if (err) callback(err);
            else asyncSeries(array.slice(1), iterator, callback);
        });
    } else {
        callback();
    }
}
