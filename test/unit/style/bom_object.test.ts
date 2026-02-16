// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import {mockFetch} from '../../util/network';
import Style from '../../../src/style/style';
import {StubMap} from './utils';

function createStyleJSON(properties) {
    return Object.assign({
        version: 8,
        sources: {},
        layers: []
    }, properties);
}

describe('Style#getBOMObject', () => {
    test('returns array with root style for simple style', async () => {
        const style = new Style(new StubMap());

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const initialStyle = createStyleJSON({
            modified: '2024-01-01T00:00:00Z'
        });

        mockFetch({
            '/style.json': () => new Response(JSON.stringify(initialStyle))
        });

        await new Promise(resolve => {
            style.once('style.load', resolve);
            style.loadURL('/style.json');
        });

        const bom = style.getBOMObject();
        expect(bom.length).toBeGreaterThanOrEqual(1);
        expect(bom[0].style).toBeDefined();
        expect(bom[0].style).toContain('/style.json');
    });

    test('includes root style with globalId and modified date', async () => {
        const style = new Style(new StubMap());

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const initialStyle = createStyleJSON({
            modified: '2024-01-15T10:30:00Z'
        });

        mockFetch({
            '/style.json': () => new Response(JSON.stringify(initialStyle))
        });

        await new Promise(resolve => {
            style.once('style.load', resolve);
            style.loadURL('/style.json');
        });

        const bom = style.getBOMObject();
        expect(bom[0].style).toContain('/style.json');
        expect(bom[0].modified).toBe('2024-01-15T10:30:00Z');
    });

    test('includes tileset URLs from sources with tiles array', async () => {
        const style = new Style(new StubMap());

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const initialStyle = createStyleJSON({
            modified: '2024-02-20T14:45:00Z',
            sources: {
                'streets': {
                    type: 'vector',
                    url: 'https://api.example.com/tiles/streets'
                },
                'terrain': {
                    type: 'raster-dem',
                    url: 'https://api.example.com/tiles/terrain'
                }
            }
        });

        const tileJSONResponse = (id: string) => new Response(JSON.stringify({
            tilejson: '2.2.0',
            tiles: [`https://api.example.com/tiles/${id}/{z}/{x}/{y}.pbf`],
            data: {
                modified: '2024-01-01T00:00:00Z'
            }
        }));

        mockFetch({
            '/style.json': () => new Response(JSON.stringify(initialStyle)),
            'https://api.example.com/tiles/streets': () => tileJSONResponse('streets'),
            'https://api.example.com/tiles/terrain': () => tileJSONResponse('terrain')
        });

        await new Promise(resolve => {
            style.once('style.load', resolve);
            style.loadURL('/style.json');
        });

        const bom = style.getBOMObject();

        // Should have root style + 2 tilesets
        expect(bom.length).toBe(3);

        // First entry is the root style
        expect(bom[0].style).toContain('/style.json');

        // Remaining entries are tilesets
        const tilesets = bom.filter(entry => entry.tileset);
        expect(tilesets).toHaveLength(2);

        const tilesetUrls = tilesets.map(entry => entry.tileset);
        expect(tilesetUrls).toContain('https://api.example.com/tiles/streets');
        expect(tilesetUrls).toContain('https://api.example.com/tiles/terrain');
    });

    test('excludes sources without url property (like geojson)', async () => {
        const style = new Style(new StubMap());

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const initialStyle = createStyleJSON({
            modified: '2024-01-01T00:00:00Z',
            sources: {
                'vector-source': {
                    type: 'vector',
                    url: 'https://api.example.com/tiles/v1'
                },
                'geojson-source': {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: []
                    }
                }
            }
        });

        const tileJSONResponse = new Response(JSON.stringify({
            tilejson: '2.2.0',
            tiles: ['https://api.example.com/tiles/v1/{z}/{x}/{y}.pbf'],
            data: {
                modified: '2024-01-01T00:00:00Z'
            }
        }));

        mockFetch({
            '/style.json': () => new Response(JSON.stringify(initialStyle)),
            'https://api.example.com/tiles/v1': () => tileJSONResponse
        });

        await new Promise(resolve => {
            style.once('style.load', resolve);
            style.loadURL('/style.json');
        });

        const bom = style.getBOMObject();

        // Should have root style + 1 tileset (geojson source excluded)
        const tilesets = bom.filter(entry => entry.tileset);
        expect(tilesets).toHaveLength(1);
        expect(tilesets[0].tileset).toBe('https://api.example.com/tiles/v1');
    });

    test('includes imported styles from fragments', async () => {
        const style = new Style(new StubMap());

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const fragment = createStyleJSON({
            modified: '2024-02-15T08:00:00Z',
            sources: {
                'composite': {
                    type: 'vector',
                    url: 'https://api.example.com/tiles/composite'
                }
            },
            layers: [{id: 'background', type: 'background'}]
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const initialStyle = createStyleJSON({
            modified: '2024-02-20T14:45:00Z',
            imports: [{id: 'basemap', url: '/styles/basemap.json'}],
            sources: {
                'custom-data': {
                    type: 'vector',
                    url: 'https://api.example.com/tiles/custom'
                }
            }
        });

        const tileJSONResponse = (id: string) => new Response(JSON.stringify({
            tilejson: '2.2.0',
            tiles: [`https://api.example.com/tiles/${id}/{z}/{x}/{y}.pbf`],
            data: {
                modified: '2024-01-01T00:00:00Z'
            }
        }));

        mockFetch({
            '/style.json': () => new Response(JSON.stringify(initialStyle)),
            '/styles/basemap.json': () => new Response(JSON.stringify(fragment)),
            'https://api.example.com/tiles/composite': () => tileJSONResponse('composite'),
            'https://api.example.com/tiles/custom': () => tileJSONResponse('custom')
        });

        await new Promise(resolve => {
            style.once('style.load', resolve);
            style.loadURL('/style.json');
        });

        const bom = style.getBOMObject();

        // Should have: root style, imported style, and tilesets
        const styles = bom.filter(entry => entry.style);
        expect(styles.length).toBeGreaterThanOrEqual(2);

        const styleUrls = styles.map(entry => entry.style);
        expect(styleUrls.some(url => url.includes('/style.json'))).toBe(true);
        expect(styleUrls.some(url => url.includes('/styles/basemap.json'))).toBe(true);

        // Should have tilesets from both root and imported style
        const tilesets = bom.filter(entry => entry.tileset);
        const tilesetUrls = tilesets.map(entry => entry.tileset);
        expect(tilesetUrls).toContain('https://api.example.com/tiles/custom');
        expect(tilesetUrls).toContain('https://api.example.com/tiles/composite');
    });

    test('handles nested imports (multiple levels) with sources', async () => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        // Deepest level nested fragment with its own source
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const foundationFragment = createStyleJSON({
            modified: '2024-01-01T09:00:00Z',
            sources: {
                'foundation-tiles': {
                    type: 'vector',
                    url: 'https://api.example.com/tiles/foundation'
                }
            }
        });

        // Middle level nested fragment with import and its own source
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const baseFragment = createStyleJSON({
            modified: '2024-02-01T12:00:00Z',
            imports: [{id: 'foundation', url: '/styles/foundation.json'}],
            sources: {
                'base-tiles': {
                    type: 'vector',
                    url: 'https://api.example.com/tiles/base'
                }
            }
        });

        // Root style with import and its own source
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const initialStyle = createStyleJSON({
            modified: '2024-03-01T16:00:00Z',
            imports: [{id: 'base', url: '/styles/base.json'}],
            sources: {
                'root-tiles': {
                    type: 'vector',
                    url: 'https://api.example.com/tiles/root'
                }
            }
        });

        // Mock TileJSON responses for vector sources
        const tileJSONResponse = (id: string) => new Response(JSON.stringify({
            tilejson: '2.2.0',
            tiles: [`https://api.example.com/tiles/${id}/{z}/{x}/{y}.pbf`],
            data: {
                modified: '2024-01-01T00:00:00Z'
            }
        }));

        mockFetch({
            '/style.json': () => new Response(JSON.stringify(initialStyle)),
            '/styles/base.json': () => new Response(JSON.stringify(baseFragment)),
            '/styles/foundation.json': () => new Response(JSON.stringify(foundationFragment)),
            'https://api.example.com/tiles/root': () => tileJSONResponse('root'),
            'https://api.example.com/tiles/base': () => tileJSONResponse('base'),
            'https://api.example.com/tiles/foundation': () => tileJSONResponse('foundation')
        });

        await new Promise(resolve => {
            map.once('style.load', resolve);
            style.loadURL('/style.json');
        });

        const bom = style.getBOMObject();

        // Should have 3 styles (root, base, foundation)
        const styles = bom.filter(entry => entry.style);
        expect(styles.length).toBe(3);

        const styleUrls = styles.map(entry => entry.style);
        expect(styleUrls.some(url => url.includes('/style.json'))).toBe(true);
        expect(styleUrls.some(url => url.includes('/styles/base.json'))).toBe(true);
        expect(styleUrls.some(url => url.includes('/styles/foundation.json'))).toBe(true);

        // Should have 3 tilesets - one from each level of imports
        const tilesets = bom.filter(entry => entry.tileset);
        expect(tilesets.length).toBe(3);

        const tilesetUrls = tilesets.map(entry => entry.tileset);
        expect(tilesetUrls).toContain('https://api.example.com/tiles/root');
        expect(tilesetUrls).toContain('https://api.example.com/tiles/base');
        expect(tilesetUrls).toContain('https://api.example.com/tiles/foundation');
    });

    test('avoids duplicate entries for circular imports', async () => {
        const style = new Style(new StubMap());

        // Parent imports child which imports parent again
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const childFragment = createStyleJSON({
            modified: '2024-05-01T09:00:00Z',
            imports: [{id: 'parent', url: '/style.json'}],
            sources: {}
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const initialStyle = createStyleJSON({
            modified: '2024-05-01T10:00:00Z',
            imports: [{id: 'child', url: '/styles/child.json'}],
            sources: {}
        });

        mockFetch({
            '/style.json': () => new Response(JSON.stringify(initialStyle)),
            '/styles/child.json': () => new Response(JSON.stringify(childFragment))
        });

        await new Promise(resolve => {
            style.once('style.load', resolve);
            style.loadURL('/style.json');
        });

        const bom = style.getBOMObject();

        // Should only have 2 unique styles (no duplicates from circular import)
        const styles = bom.filter(entry => entry.style);
        expect(styles.length).toBe(2);

        const uniqueStyleUrls = new Set(styles.map(entry => entry.style));
        expect(uniqueStyleUrls.size).toBe(2);
    });

    test('handles style with no sources', async () => {
        const style = new Style(new StubMap());

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const initialStyle = createStyleJSON({
            modified: '2024-04-01T10:00:00Z',
            layers: [{
                id: 'background',
                type: 'background',
                paint: {'background-color': '#ffffff'}
            }]
        });

        mockFetch({
            '/style.json': () => new Response(JSON.stringify(initialStyle))
        });

        await new Promise(resolve => {
            style.once('style.load', resolve);
            style.loadURL('/style.json');
        });

        const bom = style.getBOMObject();

        // Should only have the root style entry
        expect(bom.length).toBe(1);
        expect(bom[0].style).toContain('/style.json');
        expect(bom[0].modified).toBe('2024-04-01T10:00:00Z');
    });

    test('handles style loaded from JSON (with hash-based globalId)', async () => {
        const style = new Style(new StubMap());

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const jsonStyle = createStyleJSON({
            modified: '2024-06-01T10:00:00Z',
            sources: {}
        });

        await new Promise(resolve => {
            style.once('style.load', resolve);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            style.loadJSON(jsonStyle);
        });

        const bom = style.getBOMObject();

        // Should have root style (with json:// hash-based ID)
        expect(bom.length).toBe(1);
        expect(bom[0].style).toMatch(/^json:\/\//);
        expect(bom[0].modified).toBe('2024-06-01T10:00:00Z');
    });

    test('includes modified timestamp from stylesheet', async () => {
        const style = new Style(new StubMap());

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const initialStyle = createStyleJSON({
            modified: '2024-09-01T10:00:00Z'
        });

        mockFetch({
            '/style.json': () => new Response(JSON.stringify(initialStyle))
        });

        await new Promise(resolve => {
            style.once('style.load', resolve);
            style.loadURL('/style.json');
        });

        const bom = style.getBOMObject();
        expect(bom[0].modified).toBe('2024-09-01T10:00:00Z');
    });

    test('returns valid array structure', async () => {
        const style = new Style(new StubMap());

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const initialStyle = createStyleJSON({
            modified: '2024-01-01T00:00:00Z',
            sources: {
                'src': {
                    type: 'vector',
                    url: 'https://api.example.com/tiles/test'
                }
            }
        });

        const tileJSONResponse = new Response(JSON.stringify({
            tilejson: '2.2.0',
            tiles: ['https://api.example.com/tiles/test/{z}/{x}/{y}.pbf'],
            data: {
                modified: '2024-01-01T00:00:00Z'
            }
        }));

        mockFetch({
            '/style.json': () => new Response(JSON.stringify(initialStyle)),
            'https://api.example.com/tiles/test': () => tileJSONResponse
        });

        await new Promise(resolve => {
            style.once('style.load', resolve);
            style.loadURL('/style.json');
        });

        const bom = style.getBOMObject();

        // Should be an array
        expect(Array.isArray(bom)).toBe(true);

        // Each entry should have the expected structure
        for (const entry of bom) {
            expect(typeof entry).toBe('object');
            // Should have either style or tileset
            const hasStyle = 'style' in entry;
            const hasTileset = 'tileset' in entry;
            expect(hasStyle || hasTileset).toBe(true);
        }
    });

    test('handles fragment style converted to basemap import', async () => {
        const style = new Style(new StubMap());

        // Style with fragment: true gets converted to basemap import
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const fragmentStyle = createStyleJSON({
            fragment: true,
            modified: '2024-07-01T12:00:00Z',
            sources: {
                'map-tiles': {
                    type: 'vector',
                    url: 'https://api.example.com/tiles/map'
                }
            }
        });

        const tileJSONResponse = new Response(JSON.stringify({
            tilejson: '2.2.0',
            tiles: ['https://api.example.com/tiles/map/{z}/{x}/{y}.pbf'],
            data: {
                modified: '2024-01-01T00:00:00Z'
            }
        }));

        mockFetch({
            '/style.json': () => new Response(JSON.stringify(fragmentStyle)),
            'https://api.example.com/tiles/map': () => tileJSONResponse
        });

        await new Promise(resolve => {
            style.once('style.load', resolve);
            style.loadURL('/style.json');
        });

        const bom = style.getBOMObject();

        // Should have basemap style (the original fragment) + tileset
        // The synthetic root style has no modified, so it's excluded
        const styles = bom.filter(entry => entry.style);
        expect(styles.length).toBe(1);
        expect(styles[0].modified).toBe('2024-07-01T12:00:00Z');

        // Should have the tileset from the fragment
        const tilesets = bom.filter(entry => entry.tileset);
        expect(tilesets.length).toBe(1);
        expect(tilesets[0].tileset).toBe('https://api.example.com/tiles/map');
    });
});
