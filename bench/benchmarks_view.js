/* eslint-disable indent */
import * as d3 from 'd3';
import {kde, probabilitiesOfSuperiority, summaryStatistics, regression} from './lib/statistics.js';

const versionColor = d3.scaleOrdinal(['#1b9e77', '#7570b3', '#d95f02']);
const formatSample = d3.format(".3r");

// Map data to DOM elements and return d3 selection
function map(data, elementType, parent, className) {
    return parent.selectAll(className ? `.${className}` : elementType)
        .data(data)
        .join(elementType)
            .attr('class', className);
}

function label(g, text, x, y, transform) {
    g.select('.label')
        .attr('fill', '#000')
        .attr('text-anchor', 'end')
        .attr('x', x)
        .attr('y', y)
        .attr('transform', transform)
        .text(text);
}

function statisticsPlot(versions) {
    const margin = {top: 0, right: 20, bottom: 20, left: 0};
    const width = 960 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    const kdeWidth = 100;

    const summaries = versions
        .filter(v => v.status === 'ended')
        .map(v => v.summary);

    const t = d3.scaleLinear()
        .domain([
            d3.min(summaries.map(s => s.min)),
            d3.max(summaries.map(s => Math.min(s.max, s.q2 + 3 * s.iqr)))
        ])
        .range([height, 0])
        .clamp(true)
        .nice();

    const b = d3.scaleBand()
        .domain(versions.map(v => v.name))
        .range([kdeWidth + 20, width])
        .paddingOuter(0.15)
        .paddingInner(0.3);

    versions = versions.map(v => ({
        name: v.name,
        samples: v.samples,
        summary: v.summary,
        density: kde(v.samples, v.summary, t.ticks(50))
    }));

    const p = d3.scaleLinear()
        .domain([0, d3.max(versions.map(v => d3.max(v.density, d => d[1])))])
        .range([0, kdeWidth]);

    const line = d3.line()
        .curve(d3.curveBasis)
        .y(d => t(d[0]))
        .x(d => p(d[1]));

    const arrowPath = 'M-4,8 L0,0 L4,8';

    const plot = d3.select(this)
        .attr('class', 'statistics-plot')
        .attr('width', '100%')
        .attr('height', height + margin.top + margin.bottom)
        .style('overflow', 'visible')
        .select('.plot')
            .attr('transform', `translate(${margin.left},${margin.top})`);

    plot.select('.axis-bottom')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(p).ticks(2, '%'));

    plot.select('.axis-left')
        .call(d3.axisLeft(t).tickFormat(formatSample))
        .call(label, 'Time (ms)', 0, 12, 'rotate(-90)');

    map(versions, 'path', plot, 'density')
        .attr('fill', 'none')
        .attr('stroke', d => versionColor(d.name))
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.7)
        .attr('d', d => line(d.density));

    map(versions, 'g', plot, 'version')
        .attr('transform', d => `translate(${b(d.name)},0)`)
        .attr('font-size', 10)
        .attr('font-family', 'sans-serif')
        .each(function(v) {
            if (v.samples.length === 0) return null;

            const bandwidth = b.bandwidth();
            const color = versionColor(v.name);
            const scale = d3.scaleLinear()
                .domain([0, v.samples.length])
                .range([0, bandwidth]);

            const {
                mean,
                trimmedMean,
                q1,
                q2,
                q3,
                min,
                max,
                argmin,
                argmax
            } = v.summary;

            const tMax = t.domain()[1];

            const g = d3.select(this);

            map(v.samples, 'circle', g)
                .attr('fill', color)
                .attr('cx', (d, i) => scale(i))
                .attr('cy', d => t(d))
                .attr('r', (d, i) => i === argmin || i === argmax ? 2 : 1)
                .attr('fill-opacity', d => d < tMax ? 1 : 0);

            map(v.samples.filter(d => d >= tMax), 'path', g, 'up-arrow')
                .attr('d', arrowPath)
                .attr('x', (d, i) => scale(i))
                .attr('y', d => t(d))
                .attr('stroke', color)
                .attr('stroke-width', (d, i) => i === argmin || i === argmax ? 2 : 1)
                .attr('fill', 'rgba(200, 0, 0, 0.5)');

            map([[q1, q3]], 'line', g, 'quartiles')
                .attr('class', 'quartiles')
                .attr('x1', bandwidth / 2)
                .attr('x2', bandwidth / 2)
                .attr('y1', d => t(d[0]))
                .attr('y2', d => t(d[1]))
                .attr('stroke', color)
                .attr('stroke-width', bandwidth)
                .attr('stroke-opacity', 0.5);

            map([q2], 'line', g, 'median')
                .attr('x1', bandwidth / 2)
                .attr('x2', bandwidth / 2)
                .attr('y1', d => t(d) - 0.5)
                .attr('y2', d => t(d) + 0.5)
                .attr('stroke', color)
                .attr('stroke-width', bandwidth)
                .attr('stroke-opacity', 1);

            map([mean], 'path', g, 'mean-arrow')
                .attr('d', arrowPath)
                .attr('x', 0)
                .attr('y', 0)
                .attr('transform', d => d >= tMax ? 'translate(-10, 0)' : `translate(-5, ${t(d)}) rotate(90)`)
                .attr('stroke', color)
                .attr('fill', color)
                .attr('fill-opacity', 0.4);

            map([trimmedMean], 'path', g, 'trimmed-mean-arrow')
                .attr('d', arrowPath)
                .attr('x', 0)
                .attr('y', 0)
                .attr('transform', d => `translate(-5, ${t(d)}) rotate(90)`)
                .attr('stroke', color)
                .attr('fill', color);

            map([mean, trimmedMean], 'text', g, 'left')
                .attr('dx', -16)
                .attr('dy', '.3em')
                .attr('x', 0)
                .attr('y', d => t(d))
                .attr('text-anchor', 'end')
                .text(d => formatSample(d));

            map([[argmin, min], [argmax, max]], 'text', g, 'extent')
                .attr('dx', 0)
                .attr('dy', (d, i) => i === 0 ? '1.3em' : '-0.7em')
                .attr('x', d => scale(d[0]))
                .attr('y', d => t(d[1]))
                .attr('text-anchor', 'middle')
                .text(d => formatSample(d[1]));

            map([q1, q2, q3], 'text', g, 'right')
                .attr('dx', 6)
                .attr('dy', '.3em')
                .attr('x', bandwidth)
                .attr('y', d => t(d))
                .attr('text-anchor', 'start')
                .text(d => formatSample(d));
        });
}

function regressionPlot(versions) {
    const margin = {top: 10, right: 20, bottom: 30, left: 0};
    const width = 960 - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;

    versions = versions.filter(version => version.regression);

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

    const plot = d3.select(this)
        .attr('class', 'regression-plot')
        .attr('width', '100%')
        .attr('height', height + margin.top + margin.bottom)
        .style('overflow', 'visible')
        .select('.plot')
            .attr('transform', `translate(${margin.left},${margin.top})`);

    plot.select('.axis-bottom')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .call(label, 'Iterations', width, -6);

    plot.select('.axis-left')
        .call(d3.axisLeft(y).ticks(4).tickFormat(formatSample))
        .call(label, 'Time (ms)', 0, 12, 'rotate(-90)');

    map(versions, 'path', plot, 'regression')
        .attr('stroke', d => versionColor(d.name))
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.5)
        .attr('d', d => line(d.regression.data.map(p => [
            p[0],
            p[0] * d.regression.slope + d.regression.intercept
        ])));

    map(versions, 'g', plot, 'version')
        .attr('fill', d => versionColor(d.name))
        .attr('fill-opacity', 0.7)
        .each(function(v) {
            map(v.regression.data, 'circle', d3.select(this))
                .attr('r', 2)
                .attr('cx', d => x(d[0]))
                .attr('cy', d => y(d[1]));
        });
}

function emptyPlot(selection) {
    const svg = selection.append('svg');

    svg.append('g')
        .attr('class', 'plot')
        .call(g => {
            g.append('g')
                .attr('class', 'axis-bottom')
                .append('text')
                    .attr('class', 'label');
            g.append('g')
                .attr('class', 'axis-left')
                .append('text')
                    .attr('class', 'label');
        });

    return svg;
}

function emptyTable(selection) {
    const div = selection.append('div');
    const tbody = div.append('table')
        .append('tbody');

    tbody.append('tr')
        .attr('class', 'head-row')
        .append('th')
        .append('h2')
            .attr('class', 'name');

    tbody.append('tr')
        .attr('class', 'location-row');

    map(['(20% trimmed) Mean', '(Windsorized) Deviation', 'R² Slope / Correlation', 'Minimum'], 'tr', tbody, 'statistic-row')
        .append('th')
            .text(d => d);

    tbody.append('tr')
        .attr('class', 'pInferiority-row');

    return div;
}

function benchmarkStatistic(version, formatStatistic) {
    switch (version.status) {
    case 'waiting':
        return '';
    case 'running':
        return 'Running...';
    case 'errored':
        return version.error.message;
    default:
        return formatStatistic(version);
    }
}

function benchmarkRow(benchmark) {
    const versions = benchmark.versions;
    const endedCount = versions.filter(version => version.status === 'ended').length;

    let main;
    let current;
    if (/main/.test(versions[0].name)) {
        [main, current] = versions;
    } else {
        [current, main] = versions;
    }

    let change;
    let pInferiority;
    if (endedCount === 2) {
        const delta = current.summary.trimmedMean - main.summary.trimmedMean;
        // Use "Cohen's d" (modified to used the trimmed mean/sd) to decide
        // how much to emphasize difference between means
        // https://en.wikipedia.org/wiki/Effect_size#Cohen.27s_d
        const pooledDeviation = Math.sqrt(
            (
                (main.samples.length - 1) * Math.pow(main.summary.windsorizedDeviation, 2) +
                (current.samples.length - 1) * Math.pow(current.summary.windsorizedDeviation, 2)
            ) /
            (main.samples.length + current.samples.length - 2)
        );
        const d = delta / pooledDeviation;

        const {superior, inferior} = probabilitiesOfSuperiority(main.samples, current.samples);

        change = `<span class=${d < 0.2 ? 'quiet' : d < 1.5 ? '' : 'strong'}>
            (${delta > 0 ? '+' : ''}${formatSample(delta)} ms / ${d.toFixed(1)} std devs)
        </span>`;

        const comparison = inferior > superior ? 'SLOWER' : 'faster';
        const probability = Math.max(inferior, superior);
        pInferiority = `<p class=${`center ${probability > 0.90 ? 'strong' : 'quiet'}`}>
            ${(probability * 100).toFixed(0)}%
            chance that a random <svg width='8' height='8'><circle fill=${versionColor(current.name)} cx='4' cy='4' r='4' /></svg> sample is
            ${comparison} than a random <svg width='8' height='8'><circle fill=${versionColor(main.name)} cx='4' cy='4' r='4' /></svg> sample.
        </p>`;
    }

    const div = d3.select(this)
        .attr('class', 'col12 clearfix space-bottom');

    const tbody = div.select('table')
        .attr('class', 'fixed space-bottom')
        .select('tbody');

    if (benchmark.location) {
        tbody.select('.location-row')
            .style('color', '#1287A8')
            .call(tr => {
                map([
                    benchmark.location.description,
                    `Zoom Level: ${benchmark.location.zoom}`,
                    `Lat: ${benchmark.location.center[1]} Lng: ${benchmark.location.center[0]}`
                ], 'th', tr)
                    .text(d => d);
            });
    }

    tbody.select('.name')
        .text(benchmark.name);

    map(versions, 'th', tbody.select('.head-row'), 'version')
        .style('color', d => versionColor(d.name))
        .text(d => d.name);

    tbody.selectAll('.statistic-row')
        .data([
            v => `${formatSample(v.summary.trimmedMean)} ms ${current && v.name === current.name && change ? change : ''}`,
            v => `${formatSample(v.summary.windsorizedDeviation)} ms`,
            v => `${formatSample(v.regression.slope)} ms / ${v.regression.correlation.toFixed(3)} ${
                v.regression.correlation < 0.9 ? '\u2620\uFE0F' :
                v.regression.correlation < 0.99 ? '\u26A0\uFE0F' : ''}`,
            v => `${formatSample(v.summary.min)} ms`
        ])
        .selectAll('td')
        .data(d => versions.map(v => benchmarkStatistic(v, d)))
        .join('td')
            .html(d => d);

    tbody.select('.pInferiority-row')
        .selectAll('td')
        .data(pInferiority ? [pInferiority] : [])
        .join('td')
            .attr('colspan', 3)
            .html(pInferiority);

    if (endedCount > 0) {
        div.selectAll('.statistics-plot')
            .data([versions])
            .join(emptyPlot)
                .each(statisticsPlot);

        div.selectAll('.regression-plot')
            .data([versions])
            .join(emptyPlot)
                .each(regressionPlot);
    }
}

function benchmarkList(div, benchmarks, finished) {
    div.style('width', '960px')
        .style('margin', '2em auto');

    map([finished], 'h1', div, 'space-bottom1')
        .text(d => `Mapbox GL JS Benchmarks - ${d ? 'Finished' : 'Running'}`);

    div.selectAll('div')
        .data(benchmarks)
        .join(emptyTable)
            .each(benchmarkRow);
}

function updateUI(benchmarks, finished) {
    finished = !!finished;

    d3.select('#benchmarks')
        .call(benchmarkList, benchmarks, finished);
}

export function run(benchmarks) {
    const filter = window.location.hash.substr(1);
    if (filter) benchmarks = benchmarks.filter(({name}) => name === filter);

    for (const benchmark of benchmarks) {
        for (const version of benchmark.versions) {
            version.status = 'waiting';
            version.logs = [];
            version.samples = [];
            version.summary = {};
        }
    }

    updateUI(benchmarks);

    let promise = Promise.resolve();

    benchmarks.forEach(bench => {
        bench.versions.forEach(version => {
            promise = promise.then(() => {
                version.status = 'running';
                updateUI(benchmarks);

                return version.bench.run()
                    .then(measurements => {
                        // scale measurements down by iteration count, so that
                        // they represent (average) time for a single iteration
                        const samples = measurements.map(({time, iterations}) => time / iterations);
                        version.status = 'ended';
                        version.samples = samples;
                        version.summary = summaryStatistics(samples);
                        version.regression = regression(measurements);
                        updateUI(benchmarks);
                    })
                    .catch(error => {
                        version.status = 'errored';
                        version.error = error;
                        updateUI(benchmarks);
                    });
            });
        });
    });

    promise = promise.then(() => {
        updateUI(benchmarks, true);
    });
}
