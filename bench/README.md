# Benchmarks

Benchmarks help us catch performance regressions and improve performance.

## Running Benchmarks

Start the benchmark server

```bash
MAPBOX_ACCESS_TOKEN={YOUR MAPBOX ACCESS TOKEN} npm run start-bench
```

To run all benchmarks, open [the benchmark page, `http://localhost:9966/bench`](http://localhost:9966/bench).

To run a specific benchmark, add its name to the url hash, for example [`http://localhost:9966/bench/#buffer`](http://localhost:9966/bench/#buffer).

## Writing a Benchmark

Good benchmarks

 - are precise (i.e. running it multiple times returns roughly the same result)
 - operate in a way that mimics real-world usage
 - use a large quantity of diverse real-world data
 - are conceptually simple

Benchmarks are implemented as a function that returns an instance of `Evented`.

```js
createBenchmark(options: {
    accessToken: string;
    createMap: (options: {
        width: number;
        height: number;
        ... // supports all options for the Map constructor
    }):Map
}): Evented
```

The instance of `Evented` may fire any number of `log` and `error` events. The
instance of `Evented` must fire exactly one `end` event.

### `log`

Fire the `log` event to report benchmark progress to the user.

```js
{
    message: string;
    color: string = 'blue'; // name of a Mapbox base color https://mapbox.com/base/styling/color
}
```

If your benchmark has a notion of running multiple "samples", you might emit
one `log` event per sample.

```js
benchmark.fire('log', {
    message: 'Finished sample ' + i + ' in ' + formatNumber(time) + ' ms'
});
```

These events have no machine-semantic meaning.

### `end`

Fire the `end` event to indicate the benchmark has finished running and report
its results.

These events have both human-readable results (`message`) and machine-readable results (`score`). Smaller `score`s are "better."

```js
{
    message: string;
    score: number;
}
```

```js
benchmark.fire('end', {
    message: 'Average time is ' + formatNumber(averageTime)) + 'ms',
    score: averageTime
});
```

### `error`

Fire the `error` event to indicate the benchmark has encountered an error.

```js
{
    error: Error;
}
```
