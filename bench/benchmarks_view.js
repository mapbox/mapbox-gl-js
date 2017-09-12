'use strict';

/* global d3 */

const versionColor = d3.scaleOrdinal(d3.schemeCategory10);
versionColor(0); // Skip blue -- too similar to link color.

const formatSample = d3.format(".3r");
const Axis = require('./lib/axis');

class StatisticsPlot extends React.Component {
    constructor(props) {
        super(props);
        this.state = {width: 100};
    }

    render() {
        function kernelDensityEstimator(kernel, ticks) {
            return function(samples) {
                if (samples.length === 0) {
                    return [];
                }
                // https://en.wikipedia.org/wiki/Kernel_density_estimation#A_rule-of-thumb_bandwidth_estimator
                const bandwidth = 1.06 * d3.deviation(samples) * Math.pow(samples.length, -0.2);
                return ticks.map((x) => {
                    return [x, d3.mean(samples, (v) => kernel((x - v) / bandwidth)) / bandwidth];
                });
            };
        }

        function kernelEpanechnikov(v) {
            return Math.abs(v) <= 1 ? 0.75 * (1 - v * v) : 0;
        }

        const margin = {top: 0, right: 20, bottom: 20, left: 0};
        const width = this.state.width - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;
        const kdeWidth = 100;

        const t = d3.scaleLinear()
            .domain([
                d3.min(this.props.versions.map(v => d3.min(v.samples))),
                d3.max(this.props.versions.map(v => d3.max(v.samples)))
            ])
            .range([height, 0])
            .nice();

        const b = d3.scaleBand()
            .domain(this.props.versions.map(v => v.name))
            .range([kdeWidth + 20, width])
            .paddingOuter(0.15)
            .paddingInner(0.3);

        const kde = kernelDensityEstimator(kernelEpanechnikov, t.ticks(50));
        const versions = this.props.versions.map(v => ({
            name: v.name,
            samples: v.samples,
            density: kde(v.samples)
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

                        const sorted = v.samples.slice().sort(d3.ascending);
                        const [q1, q2, q3] = [.25, .5, .75].map((d) => d3.quantile(sorted, d));
                        const mean = d3.mean(sorted);

                        let min = [NaN, Infinity];
                        let max = [NaN, -Infinity];
                        for (let i = 0; i < v.samples.length; i++) {
                            const s = v.samples[i];
                            if (s < min[1]) min = [i, s];
                            if (s > max[1]) max = [i, s];
                        }

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
                                        r={i === min[0] || i === max[0] ? 2 : 1} />
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
                                {[min, max].map((d, i) =>
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

function regression(samples) {
    const result = [];
    for (let i = 0, n = 1; i + n < samples.length; i += n, n++) {
        result.push([n, samples.slice(i, i + n).reduce(((sum, sample) => sum + sample), 0)]);
    }
    return result;
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
            return <p>{this.props.statistic(this.props)}</p>;
        }
    }
}

class BenchmarkRow extends React.Component {
    render() {
        const ended = this.props.versions.find(version => version.status === 'ended');
        return (
            <div className="col12 clearfix space-bottom">
                <h2 className="col4"><a href={`#${this.props.name}`} onClick={this.reload}>{this.props.name}</a></h2>
                <div className="col8">
                    <table className="fixed space-bottom">
                        <tr><th></th>{this.props.versions.map(version => <th style={{color: versionColor(version.name)}} key={version.name}>{version.name}</th>)}</tr>
                        {this.renderStatistic('R² Slope / Correlation',
                            (version) => `${formatSample(version.regression.slope)} ms / ${version.regression.correlation.toFixed(3)} ${
                                version.regression.correlation < 0.9 ? '\u2620\uFE0F' :
                                version.regression.correlation < 0.99 ? '\u26A0\uFE0F' : ''}`)}
                        {this.renderStatistic('Mean',
                            (version) => `${formatSample(d3.mean(version.samples))} ms`)}
                        {this.renderStatistic('Minimum',
                            (version) => `${formatSample(d3.min(version.samples))} ms`)}
                        {this.renderStatistic('Deviation',
                            (version) => `${formatSample(d3.deviation(version.samples))} ms`)}
                    </table>
                    {ended && <StatisticsPlot versions={this.props.versions}/>}
                    {ended && <RegressionPlot versions={this.props.versions}/>}
                </div>
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
            samples: []
        };

        benchmark.versions.push(version);

        promise = promise.then(() => {
            version.status = 'running';
            update();

            return window.mapboxglBenchmarks[name][ver].run()
                .then(samples => {
                    version.status = 'ended';
                    version.samples = samples;
                    version.regression = leastSquaresRegression(regression(samples));
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

function leastSquaresRegression(data) {
    const meanX = d3.sum(data, d => d[0]) / data.length;
    const meanY = d3.sum(data, d => d[1]) / data.length;
    const varianceX = d3.variance(data, d => d[0]);
    const sdX = Math.sqrt(varianceX);
    const sdY = d3.deviation(data, d => d[1]);
    const covariance = d3.sum(data, ([x, y]) =>
        (x - meanX) * (y - meanY)
    ) / (data.length - 1);

    const correlation = covariance / sdX / sdY;
    const slope = covariance / varianceX;
    const intercept = meanY - slope * meanX;

    return { correlation, slope, intercept, data };
}
