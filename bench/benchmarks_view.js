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
            <h1 className="space-bottom">
                Benchmarks
                <a
                    className={[
                        'fr',
                        'icon',
                        'clipboard',
                        'button',
                        (this.getStatus() === 'ended' ? '' : 'disabled')
                    ].join(' ')}
                    data-clipboard-text={this.renderTextBenchmarks()}>
                    Copy Results
                </a>
            </h1>
            <table>
                <thead>
                <tr>
                    <th>Benchmark</th>
                    {this.versions().map((v) => <th key={v}>{v}</th>)}
                </tr>
                </thead>
                <tbody>
                    {Object.keys(this.state.results).map(this.renderBenchmark)}
                </tbody>
            </table>
        </div>;
    },

    renderBenchmark: function(name) {
        return <tr key={name}>
            <th><a href={`#${name}`} onClick={this.reload}>{name}</a></th>
            {Object.keys(this.state.results[name]).map(this.renderBenchmarkVersion.bind(this, name))}
        </tr>;
    },

    renderBenchmarkVersion: function(name, version) {
        const results = this.state.results[name][version];
        return (
            <td id={name + version}
                key={version}
                className={results.status === 'waiting' ? 'quiet' : ''}>
                {results.logs.map((log, index) => {
                    return <div key={index} className={`pad1 dark fill-${log.color}`}>{log.message}</div>;
                })}
            </td>
        );
    },

    versions: function() {
        const versions = [];
        for (const name in this.state.results) {
            for (const version in this.state.results[name]) {
                if (versions.indexOf(version) < 0) {
                    versions.push(version);
                }
            }
        }
        return versions;
    },

    renderTextBenchmarks: function() {
        const versions = this.versions();
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
    },

    reload() {
        location.reload();
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
