'use strict';

/* global d3 */

module.exports = {
    summaryStatistics,
    regression,
    kde
};

function summaryStatistics(data) {
    const variance = d3.variance(data);
    const sorted = data.slice().sort(d3.ascending);
    const [q1, q2, q3] = [.25, .5, .75].map((d) => d3.quantile(sorted, d));
    const mean = d3.mean(sorted);
    let min = [NaN, Infinity];
    let max = [NaN, -Infinity];
    for (let i = 0; i < data.length; i++) {
        const s = data[i];
        if (s < min[1]) min = [i, s];
        if (s > max[1]) max = [i, s];
    }

    // 20% trimmed mean
    const [lowerQuintile, upperQuintile] = [.2, .8].map(d => d3.quantile(sorted, d));
    const trimmedMean = d3.mean(data.filter(d => d >= lowerQuintile && d <= upperQuintile));
    const windsorizedDeviation = d3.deviation(
        data.map(d => d < lowerQuintile ? lowerQuintile :
            d > upperQuintile ? upperQuintile :
            d
        )
    );

    return {
        mean,
        trimmedMean,
        variance,
        deviation: Math.sqrt(variance),
        windsorizedDeviation,
        q1,
        q2,
        q3,
        argmin: min[0], // index of minimum value
        min: min[1],
        argmax: max[0], // index of maximum value
        max: max[1]
    };
}

function regression(samples) {
    const result = [];
    for (let i = 0, n = 1; i + n < samples.length; i += n, n++) {
        result.push([n, samples.slice(i, i + n).reduce(((sum, sample) => sum + sample), 0)]);
    }
    return leastSquaresRegression(result);
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

function kde(samples, ticks) {
    const kernel = kernelEpanechnikov;

    if (samples.length === 0) {
        return [];
    }
    // https://en.wikipedia.org/wiki/Kernel_density_estimation#A_rule-of-thumb_bandwidth_estimator
    const bandwidth = 1.06 * d3.deviation(samples) * Math.pow(samples.length, -0.2);
    return ticks.map((x) => {
        return [x, d3.mean(samples, (v) => kernel((x - v) / bandwidth)) / bandwidth];
    });
}

function kernelEpanechnikov(v) {
    return Math.abs(v) <= 1 ? 0.75 * (1 - v * v) : 0;
}

