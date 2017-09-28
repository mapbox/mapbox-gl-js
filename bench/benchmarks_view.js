'use strict';

/* global d3 */

const versionColor = d3.scaleOrdinal(['#1b9e77', '#7570b3']);

const formatSample = d3.format(".3r");
const Axis = require('./lib/axis');
const {
    summaryStatistics,
    regression,
    kde,
    probabilitiesOfSuperiority
} = require('./lib/statistics');

class StatisticsPlot extends React.Component {
    constructor(props) {
        super(props);
        this.state = {width: 100};
    }

    render() {
        const margin = {top: 0, right: 20, bottom: 20, left: 0};
        const width = this.state.width - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;
        const kdeWidth = 100;

        const t = d3.scaleLinear()
            .domain([
                d3.min(this.props.versions.map(v => v.summary.min || Infinity)),
                d3.max(this.props.versions.map(v => v.summary.max || -Infinity))
            ])
            .range([height, 0])
            .nice();

        const b = d3.scaleBand()
            .domain(this.props.versions.map(v => v.name))
            .range([kdeWidth + 20, width])
            .paddingOuter(0.15)
            .paddingInner(0.3);

        const versions = this.props.versions.map(v => ({
            name: v.name,
            samples: v.samples,
            summary: v.summary,
            density: kde(v.samples, t.ticks(50))
        }));

        const p = d3.scaleLinear()
            .domain([0, d3.max(versions.map(v => d3.max(v.density, d => d[1])))])
            .range([0, kdeWidth]);

        const line = d3.line()
            .curve(d3.curveBasis)
            .y(d => t(d[0]))
            .x(d => p(d[1]));

        return (
            <svg
                width="100%"
                height={height + margin.top + margin.bottom}
                style={{overflow: 'visible'}}
                ref={(ref) => { this.ref = ref; }}>
                <g transform={`translate(${margin.left},${margin.top})`}>
                    <Axis orientation="bottom" scale={p} ticks={[2, "%"]} transform={`translate(0,${height})`}>
                    </Axis>
                    <Axis orientation="left" scale={t} tickFormat={formatSample}>
                        <text fill='#000' textAnchor="end"  y={6} transform="rotate(-90)" dy=".71em">Time (ms)</text>
                    </Axis>
                    {versions.map((v, i) => {
                        if (v.samples.length === 0)
                            return null;

                        const bandwidth = b.bandwidth();
                        const color = versionColor(v.name);
                        const scale = d3.scaleLinear()
                            .domain([0, v.samples.length])
                            .range([0, bandwidth]);

                        const {
                            mean,
                            q1,
                            q2,
                            q3,
                            min,
                            max,
                            argmin,
                            argmax
                        } = v.summary;

                        return <g key={i}>
                            <path
                                fill="none"
                                stroke={color}
                                strokeWidth={2}
                                strokeOpacity={0.7}
                                d={line(v.density)} />
                            <g transform={`translate(${b(v.name)},0)`}>
                                {v.samples.map((d, i) =>
                                    <circle
                                        key={i}
                                        fill={color}
                                        cx={scale(i)}
                                        cy={t(d)}
                                        r={i === argmin || i === argmax ? 2 : 1} />
                                )}
                                <line // quartiles
                                    x1={bandwidth / 2}
                                    x2={bandwidth / 2}
                                    y1={t(q1)}
                                    y2={t(q3)}
                                    stroke={color}
                                    strokeWidth={bandwidth}
                                    strokeOpacity={0.5} />
                                <line // median
                                    x1={bandwidth / 2}
                                    x2={bandwidth / 2}
                                    y1={t(q2) - 0.5}
                                    y2={t(q2) + 0.5}
                                    stroke={color}
                                    strokeWidth={bandwidth}
                                    strokeOpacity={1} />
                                <line // mean
                                    x1={bandwidth / 2}
                                    x2={bandwidth / 2}
                                    y1={t(mean) - 0.5}
                                    y2={t(mean) + 0.5}
                                    stroke='white'
                                    strokeWidth={bandwidth}
                                    strokeOpacity={1} />
                                {[mean].map((d, i) =>
                                    <text // left
                                        key={i}
                                        dx={-6}
                                        dy='.3em'
                                        x={0}
                                        y={t(d)}
                                        textAnchor='end'
                                        fontSize={10}
                                        fontFamily='sans-serif'>{formatSample(d)}</text>
                                )}
                                {[[argmin, min], [argmax, max]].map((d, i) =>
                                    <text // extent
                                        key={i}
                                        dx={0}
                                        dy={i === 0 ? '1.3em' : '-0.7em'}
                                        x={scale(d[0])}
                                        y={t(d[1])}
                                        textAnchor='middle'
                                        fontSize={10}
                                        fontFamily='sans-serif'>{formatSample(d[1])}</text>
                                )}
                                {[q1, q2, q3].map((d, i) =>
                                    <text // right
                                        key={i}
                                        dx={6}
                                        dy='.3em'
                                        x={bandwidth}
                                        y={t(d)}
                                        textAnchor='start'
                                        fontSize={10}
                                        fontFamily='sans-serif'>{formatSample(d)}</text>
                                )}
                            </g>
                        </g>;
                    })}
                </g>
            </svg>
        );
    }

    componentDidMount() {
        this.setState({ width: this.ref.clientWidth });
    }
}

class RegressionPlot extends React.Component {
    constructor(props) {
        super(props);
        this.state = {width: 100};
    }

    render() {
        const margin = {top: 10, right: 20, bottom: 30, left: 0};
        const width = this.state.width - margin.left - margin.right;
        const height = 200 - margin.top - margin.bottom;
        const versions = this.props.versions.filter(version => version.regression);

        const x = d3.scaleLinear()
            .domain([0, d3.max(versions.map(version => d3.max(version.regression.data, d => d[0])))])
            .range([0, width])
            .nice();

        const y = d3.scaleLinear()
            .domain([0, d3.max(versions.map(version => d3.max(version.regression.data, d => d[1])))])
            .range([height, 0])
            .nice();

        const line = d3.line()
            .x(d => x(d[0]))
            .y(d => y(d[1]));

        return (
            <svg
                width="100%"
                height={height + margin.top + margin.bottom}
                style={{overflow: 'visible'}}
                ref={(ref) => { this.ref = ref; }}>
                <g transform={`translate(${margin.left},${margin.top})`}>
                    <Axis orientation="bottom" scale={x} transform={`translate(0,${height})`}>
                        <text fill='#000' textAnchor="end" y={-6} x={width}>Iterations</text>
                    </Axis>
                    <Axis orientation="left" scale={y} ticks={4} tickFormat={formatSample}>
                        <text fill='#000' textAnchor="end"  y={6} transform="rotate(-90)" dy=".71em">Time (ms)</text>
                    </Axis>
                    {versions.map((v, i) =>
                        <g
                            key={i}
                            fill={versionColor(v.name)}
                            fill-opacity="0.7">
                            {v.regression.data.map(([a, b], i) =>
                                <circle key={i} r="2" cx={x(a)} cy={y(b)}/>
                            )}
                            <path
                                stroke={versionColor(v.name)}
                                strokeWidth={1}
                                strokeOpacity={0.5}
                                d={line(v.regression.data.map(d => [
                                    d[0],
                                    d[0] * v.regression.slope + v.regression.intercept
                                ]))} />
                        </g>
                    )}
                </g>
            </svg>
        );
    }

    componentDidMount() {
        this.setState({ width: this.ref.clientWidth });
    }
}

class BenchmarkStatistic extends React.Component {
    render() {
        switch (this.props.status) {
        case 'waiting':
            return <p className="quiet"></p>;
        case 'running':
            return <p>Running...</p>;
        case 'error':
            return <p>{this.props.error.message}</p>;
        default:
            return this.props.statistic(this.props);
        }
    }
}

class BenchmarkRow extends React.Component {
    render() {
        const endedCount = this.props.versions.filter(version => version.status === 'ended').length;

        let master;
        let current;
        if (/master/.test(this.props.versions[0].name)) {
            [master, current] = this.props.versions;
        } else {
            [current, master] = this.props.versions;
        }

        let change = '';
        let pInferiority = '';
        if (endedCount === 2) {
            const delta = current.summary.trimmedMean - master.summary.trimmedMean;
            // Use "Cohen's d" (modified to used the trimmed mean/sd) to decide
            // how much to emphasize difference between means
            // https://en.wikipedia.org/wiki/Effect_size#Cohen.27s_d
            const pooledDeviation = Math.sqrt(
                (
                    (master.samples.length - 1) * Math.pow(master.summary.windsorizedDeviation, 2) +
                    (current.samples.length - 1) * Math.pow(current.summary.windsorizedDeviation, 2)
                ) /
                (master.samples.length + current.samples.length - 2)
            );
            const d = delta / pooledDeviation;

            const {superior, inferior} = probabilitiesOfSuperiority(master.samples, current.samples);

            change = <span className={d < 0.2 ? 'quiet' : d < 1.5 ? '' : 'strong'}>(
                {delta > 0 ? '+' : ''}{formatSample(delta)} ms / {d.toFixed(1)} std devs
            )</span>;

            const comparison = inferior > superior ? 'SLOWER' : 'faster';
            const probability = Math.max(inferior, superior);
            pInferiority = <p className={`center ${probability > 0.90 ? 'strong' : 'quiet'}`}>
                {(probability * 100).toFixed(0)}%
                chance that a random <svg width={8} height={8}><circle fill={versionColor(current.name)} cx={4} cy={4} r={4} /></svg> sample is
                {comparison} than a random <svg width={8} height={8}><circle fill={versionColor(master.name)} cx={4} cy={4} r={4} /></svg> sample.
            </p>;
        }

        return (
            <div className="col12 clearfix space-bottom">
                <table className="fixed space-bottom">
                    <tr><th><h2 className="col4"><a href={`#${this.props.name}`} onClick={this.reload}>{this.props.name}</a></h2></th>
                        {this.props.versions.map(version => <th style={{color: versionColor(version.name)}} key={version.name}>{version.name}</th>)}</tr>
                    {this.renderStatistic('(20% trimmed) Mean',
                        (version) => <p>
                            {formatSample(version.summary.trimmedMean)} ms
                            {version.name === current.name && change}
                        </p>)}
                    {this.renderStatistic('(Windsorized) Deviation',
                        (version) => <p>{formatSample(version.summary.windsorizedDeviation)} ms</p>)}
                    {this.renderStatistic('R² Slope / Correlation',
                        (version) => <p>{formatSample(version.regression.slope)} ms / {version.regression.correlation.toFixed(3)} {
                            version.regression.correlation < 0.9 ? '\u2620\uFE0F' :
                            version.regression.correlation < 0.99 ? '\u26A0\uFE0F' : ''}</p>)}
                    {this.renderStatistic('Minimum',
                        (version) => <p>{formatSample(version.summary.min)} ms</p>)}
                    {pInferiority && <tr><td colspan={3}>{pInferiority}</td></tr>}
                </table>
                {endedCount > 0 && <StatisticsPlot versions={this.props.versions}/>}
                {endedCount > 0 && <RegressionPlot versions={this.props.versions}/>}
            </div>
        );
    }

    renderStatistic(title, statistic) {
        return (
            <tr>
                <th>{title}</th>
                {this.props.versions.map(version =>
                    <td key={version.name}><BenchmarkStatistic statistic={statistic} {...version}/></td>
                )}
            </tr>
        );
    }

    reload() {
        location.reload();
    }
}

class BenchmarksTable extends React.Component {
    render() {
        return (
            <div style={{width: 960, margin: '2em auto'}}>
                <h1 className="space-bottom1">Mapbox GL JS Benchmarks – {this.props.finished ? 'Finished' : 'Running'}</h1>
                {this.props.benchmarks.map(benchmark => <BenchmarkRow key={benchmark.name} {...benchmark}/>)}
            </div>
        );
    }
}

const versions = window.mapboxglVersions;
const benchmarks = [];
const filter = window.location.hash.substr(1);

let finished = false;
let promise = Promise.resolve();

for (const name in window.mapboxglBenchmarks) {
    if (filter && name !== filter)
        continue;

    const benchmark = { name, versions: [] };
    benchmarks.push(benchmark);

    for (const ver in window.mapboxglBenchmarks[name]) {
        const version = {
            name: ver,
            status: 'waiting',
            logs: [],
            samples: [],
            summary: {}
        };

        benchmark.versions.push(version);

        promise = promise.then(() => {
            version.status = 'running';
            update();

            return window.mapboxglBenchmarks[name][ver].run()
                .then(samples => {
                    version.status = 'ended';
                    version.samples = samples;
                    version.summary = summaryStatistics(samples);
                    version.regression = regression(samples);
                    update();
                })
                .catch(error => {
                    version.status = 'errored';
                    version.error = error;
                    update();
                });
        });
    }
}

promise = promise.then(() => {
    finished = true;
    update();
});

function update() {
    ReactDOM.render(
        <BenchmarksTable versions={versions} benchmarks={benchmarks} finished={finished}/>,
        document.getElementById('benchmarks')
    );
}

