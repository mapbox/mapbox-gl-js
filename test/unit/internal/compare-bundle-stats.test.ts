import {describe, expect, test} from 'vitest';
import {
    diffBundleStats,
    diffBundleStatsData,
    formatBundleDiffMarkdown,
    parseBundleStats,
    type VisualizerData,
} from '../../../internal/scripts/compare-bundle-stats.js';

const baseStats: VisualizerData = {
    version: 2,
    options: {gzip: true, brotli: false},
    nodeMetas: {
        'meta-a': {
            id: 'src/foo.ts',
            moduleParts: {'mapbox-gl': 'part-a1', core: 'part-a2'},
        },
        'meta-b': {
            id: 'src/bar.ts',
            moduleParts: {'mapbox-gl': 'part-b1'},
        },
        'meta-c': {
            id: 'src/removed.ts',
            moduleParts: {shared: 'part-c1'},
        },
    },
    nodeParts: {
        'part-a1': {renderedLength: 500, gzipLength: 200, metaUid: 'meta-a'},
        'part-a2': {renderedLength: 300, gzipLength: 150, metaUid: 'meta-a'},
        'part-b1': {renderedLength: 1000, gzipLength: 400, metaUid: 'meta-b'},
        'part-c1': {renderedLength: 800, gzipLength: 300, metaUid: 'meta-c'},
    },
};

const headStats: VisualizerData = {
    version: 2,
    options: {gzip: true, brotli: false},
    nodeMetas: {
        'meta-a': {
            id: 'src/foo.ts',
            moduleParts: {'mapbox-gl': 'part-a1', core: 'part-a2'},
        },
        'meta-b': {
            id: 'src/bar.ts',
            moduleParts: {'mapbox-gl': 'part-b1'},
        },
        'meta-d': {
            id: 'src/new.ts',
            moduleParts: {shared: 'part-d1'},
        },
    },
    nodeParts: {
        'part-a1': {renderedLength: 500, gzipLength: 310, metaUid: 'meta-a'},
        'part-a2': {renderedLength: 300, gzipLength: 150, metaUid: 'meta-a'},
        'part-b1': {renderedLength: 1000, gzipLength: 300, metaUid: 'meta-b'},
        'part-d1': {renderedLength: 600, gzipLength: 250, metaUid: 'meta-d'},
    },
};

describe('compare-bundle-stats', () => {
    test('parseBundleStats aggregates gzip per file across bundles', () => {
        const files = parseBundleStats(baseStats);
        expect(files.get('src/foo.ts')).toEqual({file: 'src/foo.ts', gzip: 350, rendered: 800});
        expect(files.get('src/bar.ts')).toEqual({file: 'src/bar.ts', gzip: 400, rendered: 1000});
    });

    test('diffBundleStats reports added, removed, and changed files', () => {
        const head = parseBundleStats(headStats);
        const base = parseBundleStats(baseStats);
        const result = diffBundleStats(head, base);

        const byFile = new Map(result.entries.map((entry) => [entry.file, entry]));

        expect(byFile.get('src/foo.ts')).toMatchObject({
            baseGzip: 350,
            headGzip: 460,
            delta: 110,
            status: 'changed',
        });
        expect(byFile.get('src/bar.ts')).toMatchObject({
            baseGzip: 400,
            headGzip: 300,
            delta: -100,
            status: 'changed',
        });
        expect(byFile.get('src/new.ts')).toMatchObject({
            baseGzip: 0,
            headGzip: 250,
            delta: 250,
            status: 'added',
        });
        expect(byFile.get('src/removed.ts')).toMatchObject({
            baseGzip: 300,
            headGzip: 0,
            delta: -300,
            status: 'removed',
        });
    });

    test('diffBundleStats filters changes below 20 bytes', () => {
        const head = parseBundleStats(headStats);
        const base = parseBundleStats(baseStats);
        head.set('src/tiny.ts', {file: 'src/tiny.ts', gzip: 115, rendered: 115});
        base.set('src/tiny.ts', {file: 'src/tiny.ts', gzip: 100, rendered: 100});
        const result = diffBundleStats(head, base);

        expect(result.entries.find((entry) => entry.file === 'src/tiny.ts')).toBeUndefined();
    });

    test('diffBundleStats sorts by absolute delta', () => {
        const result = diffBundleStatsData(headStats, baseStats);

        expect(result.entries[0].file).toBe('src/removed.ts');
        expect(result.entries[1].file).toBe('src/new.ts');
        expect(result.entries[2].file).toBe('src/foo.ts');
        expect(result.entries[3].file).toBe('src/bar.ts');
    });

    test('formatBundleDiffMarkdown includes table headers and status labels', () => {
        const result = diffBundleStatsData(headStats, baseStats);
        const markdown = formatBundleDiffMarkdown(result);

        expect(markdown).toContain('### File-level changes (gzip, top 20)');
        expect(markdown).toContain('| File | Base | Head | Δ | Δ% |');
        expect(markdown).toContain('`src/new.ts` (new)');
        expect(markdown).toContain('`src/removed.ts` (removed)');
        expect(markdown).toContain('-0.30 kB');
        expect(markdown).toContain('+0.25 kB');
    });

    test('rejects unsupported visualizer data versions', () => {
        const invalid: VisualizerData = {
            version: 99,
            options: baseStats.options,
            nodeMetas: baseStats.nodeMetas,
            nodeParts: baseStats.nodeParts,
        };
        expect(() => parseBundleStats(invalid)).toThrow(/Unsupported bundle-stats version/);
    });
});
