
/* global d3 */

module.exports = {
    summaryStatistics,
    regression,
    kde,
    probabilitiesOfSuperiority
};

function probabilitiesOfSuperiority(before, after) {
    const timerPrecision = 0.005;

    let superiorCount = 0;
    let inferiorCount = 0;
    let equalCount = 0;
    let N = 0;
    for (const b of before) {
        for (const a of after) {
            N++;
            if (b - a > timerPrecision) superiorCount++;
            else if (a - b > timerPrecision) inferiorCount++;
            else equalCount++;
        }
    }

    return {
        superior: (superiorCount + equalCount) / N,
        inferior: (inferiorCount + equalCount) / N
    };
}

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
        iqr: q3 - q1,
        argmin: min[0], // index of minimum value
        min: min[1],
        argmax: max[0], // index of maximum value
        max: max[1]
    };
}

function regression(measurements) {
    const result = [];
    for (let i = 0, n = 1; i + n < measurements.length; i += n, n++) {
        const subset = measurements.slice(i, i + n);
        result.push([
            subset.reduce((sum, measurement) => sum + measurement.iterations, 0),
            subset.reduce((sum, measurement) => sum + measurement.time, 0)
        ]);
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

function kde(samples, summary, ticks) {
    const kernel = kernelEpanechnikov;

    if (samples.length === 0) {
        return [];
    }
    // https://en.wikipedia.org/wiki/Kernel_density_estimation#A_rule-of-thumb_bandwidth_estimator
    const bandwidth = 1.06 * summary.windsorizedDeviation * Math.pow(samples.length, -0.2);
    return ticks.map((x) => {
        return [x, d3.mean(samples, (v) => kernel((x - v) / bandwidth)) / bandwidth];
    });
}

function kernelEpanechnikov(v) {
    return Math.abs(v) <= 1 ? 0.75 * (1 - v * v) : 0;
}

