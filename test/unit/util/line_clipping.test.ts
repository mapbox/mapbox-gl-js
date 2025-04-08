import {EdgeIterator, type Range} from '../../../3d-style/elevation/elevation_feature';
import {clipLine, clipLines, lineSubdivision, Point4D, type LineInfo} from '../../../src/util/line_clipping';
import {describe, test, expect} from '../../util/vitest';
import Point from '@mapbox/point-geometry';

function compareLineInfo(actual: LineInfo, expected: LineInfo, tolerance: number): boolean {
    return Math.abs(actual.progress.min - expected.progress.min) <= tolerance &&
           Math.abs(actual.progress.max - expected.progress.max) <= tolerance &&
           actual.parentIndex === expected.parentIndex &&
           actual.prevPoint.equals(expected.prevPoint) &&
           actual.nextPoint.equals(expected.nextPoint);
}

class MockEdgeIterator extends EdgeIterator {
    edges: Array<[Point, Point]>;

    constructor(edges: Array<[Point, Point]>) {
        super(undefined, 0);
        this.edges = edges;
    }

    override get(): [Point, Point] {
        return this.edges[this.index];
    }

    override valid(): boolean {
        return this.index < this.edges.length;
    }
}

declare module 'vitest' {
    interface Assertion<T = any> {
        toEqualLineInfo: (expected: LineInfo, tolerance: number) => T;
    }
}

expect.extend({
    toEqualLineInfo(actual: LineInfo, expected: LineInfo, tolerance: number) {
        if (!compareLineInfo(actual, expected, tolerance)) {
            return {
                message: () => `expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`,
                pass: false
            };
        }

        return {
            message: undefined,
            pass: true
        };
    }
});

describe('clipLines', () => {
    const minX = -300;
    const maxX = 300;
    const minY = -200;
    const maxY = 200;

    const clipLineTest = (lines, linesInfo?: LineInfo[]) => {
        return clipLines(lines, minX, minY, maxX, maxY, linesInfo);
    };

    test('Single line fully inside', () => {
        const line = [
            new Point(-100, -100),
            new Point(-40, -100),
            new Point(200, 0),
            new Point(-80, 195)
        ];

        expect(clipLineTest([line])).toEqual([line]);
    });

    test('Multiline fully inside', () => {
        const line0 = [
            new Point(-250, -150),
            new Point(-250, 150),
            new Point(-10, 150),
            new Point(-10, -150)
        ];

        const line1 = [
            new Point(250, -150),
            new Point(250, 150),
            new Point(10, 150),
            new Point(10, -150)
        ];

        const lines = [line0, line1];

        expect(clipLineTest(lines)).toEqual(lines);
    });

    test('Lines fully outside', () => {
        const line0 = [
            new Point(-400, -300),
            new Point(-350, 0),
            new Point(-300, 300)
        ];

        const line1 = [
            new Point(1000, 210),
            new Point(10000, 500)
        ];

        expect(clipLineTest([line0, line1])).toEqual([]);
    });

    test('Intersect with single border', () => {
        const line0 = [
            new Point(-400, 0),
            new Point(0, 0)
        ];

        const result0 = [
            new Point(minX, 0),
            new Point(0, 0)
        ];

        const line1 = [
            new Point(250, -50),
            new Point(350, 50)
        ];

        const result1 = [
            new Point(250, -50),
            new Point(maxX, 0)
        ];

        expect(clipLineTest([line0, line1])).toEqual([result0, result1]);
    });

    test('Intersect with multiple borders', () => {
        const line0 = [
            new Point(-350, -100),
            new Point(-200, -250)
        ];

        const line1 = [
            new Point(-100, 250),
            new Point(0, 150),
            new Point(100, 250)
        ];

        const result0 = [
            new Point(minX, -150),
            new Point(-250, minY)
        ];

        const result1 = [
            new Point(-50, maxY),
            new Point(0, 150),
            new Point(50, maxY)
        ];

        expect(clipLineTest([line0, line1])).toEqual([result0, result1]);
    });

    test('Single line can be split into multiple segments', () => {
        const line = [
            new Point(-80, 150),
            new Point(-80, 350),
            new Point(120, 1000),
            new Point(120, 0)
        ];

        const result0 = [
            new Point(-80, 150),
            new Point(-80, maxY),
        ];

        const result1 = [
            new Point(120, maxY),
            new Point(120, 0),
        ];

        expect(clipLineTest([line])).toEqual([result0, result1]);
    });

    test('Non-clipped points are bit exact', () => {
        const line = [
            new Point(-500, -200),
            new Point(131.2356763, 0.956732)
        ];

        expect(clipLineTest([line])[1]).toEqual(line[0][1]);
    });

    test('Non-clipped 4D points are bit exact', () => {
        const line = [
            new Point4D(-500, -200, -100, -50),
            new Point4D(131.2356763, 0.956732, 12.34521, 0.583421)
        ];

        expect(clipLineTest([line])[1]).toEqual(line[0][1]);
    });

    test('Clipped points are rounded to the nearest integer', () => {
        const line = [
            new Point(310, 2.9),
            new Point(290, 2.5)
        ];

        const result = [
            new Point(maxX, 3),
            new Point(290, 2.5)
        ];

        expect(clipLineTest([line])).toEqual([result]);
    });

    test('Input lines are not merged', () => {
        const lines: Point[][] = [
            [
                new Point(-256, 5176),
                new Point(246, 5286),
                new Point(378, 5238)
            ],
            [
                new Point(378, 5238),
                new Point(202, 5052),
                new Point(-256, 4784)
            ]
        ];

        const expected: Point[][] = [
            [
                new Point(0, 5232),
                new Point(246, 5286),
                new Point(378, 5238)
            ],
            [
                new Point(378, 5238),
                new Point(202, 5052),
                new Point(0, 4934)
            ]
        ];

        expect(clipLines(lines, 0, 0, 8192, 8192)).toEqual(expected);
    });

    test('Clip against tile borders and track progress', () => {
        const lines: Point[][] = [
            [
                new Point(512, 4096),
                new Point(-128, 2048),
                new Point(1234, -512),
                new Point(4096, 1024),
                new Point(6000, -2048)
            ],
            [
                new Point(128, 128),
                new Point(8192, 8192)
            ]
        ];

        const expected: Point[][] = [
            [
                new Point(512, 4096),
                new Point(0, 2458)
            ],
            [
                new Point(0, 1807),
                new Point(962, 0)
            ],
            [
                new Point(2188, 0),
                new Point(4096, 1024),
                new Point(4731, 0)
            ],
            [
                new Point(128, 128),
                new Point(8192, 8192)
            ]
        ];

        const expectedInfos: LineInfo[] = [
            {
                progress: {min: 0, max: 0.144153},
                parentIndex: 0,
                prevPoint: new Point(512, 4096),
                nextPoint: new Point(-128, 2048)
            },
            {
                progress: {min: 0.203077, max: 0.375078},
                parentIndex: 0,
                prevPoint: new Point(-128, 2048),
                nextPoint: new Point(1234, -512)
            },
            {
                progress: {min: 0.514635, max: 0.797709},
                parentIndex: 0,
                prevPoint: new Point(1234, -512),
                nextPoint: new Point(6000, -2048)
            },
            {
                progress: {min: 0, max: 1},
                parentIndex: 1,
                prevPoint: new Point(128, 128),
                nextPoint: new Point(8192, 8192)
            }
        ];

        const linesInfo: LineInfo[] = [];
        const result = clipLines(lines, 0, 0, 8192, 8192, linesInfo);
        expect(result).toEqual(expected);
        expect(linesInfo.length).toEqual(result.length);
        for (let i = 0; i < linesInfo.length; i++) {
            expect(linesInfo[i]).toEqualLineInfo(expectedInfos[i], 1e-6);
        }
    });
});

describe('clipLine', () => {
    test('Completely inside bounds', () => {
        const p0 = new Point(150, 150);
        const p1 = new Point(250, 250);
        clipLine(p0, p1, 100, 300);
        expect(p0).toEqual(new Point(150, 150));
        expect(p1).toEqual(new Point(250, 250));
    });

    test('Partially inside bounds', () => {
        const p0 = new Point(50, 150);
        const p1 = new Point(250, 250);
        clipLine(p0, p1, 100, 300);
        expect(p0).toEqual(new Point(100, 175));
        expect(p1).toEqual(new Point(250, 250));
    });

    test('Partially inside bounds 2', () => {
        const p0 = new Point4D(150, 150, 1, 2);
        const p1 = new Point4D(250, 2500, 3.4, 0.123);
        clipLine(p0, p1, 100, 300);
        expect(p0).toEqual(new Point4D(150, 150, 1, 2));
        expect(p1.x).toEqual(156);
        expect(p1.y).toEqual(300);
        expect(p1.z).toBeCloseTo(1.1532, 4);
        expect(p1.w).toBeCloseTo(1.8802, 4);
    });

    test('Completely outside bounds', () => {
        const p0 = new Point(50, 50);
        const p1 = new Point(75, 75);
        clipLine(p0, p1, 100, 300);
        expect(p0).toEqual(new Point(50, 50));
        expect(p1).toEqual(new Point(75, 75));
    });

    test('Interpolated Z and W components', () => {
        const p0 = new Point4D(150, 150, 10, 20);
        const p1 = new Point4D(250, 400, 1, 2);
        clipLine(p0, p1, 100, 300);
        expect(p0).toEqual(new Point4D(150, 150, 10, 20));
        expect(p1).toEqual(new Point4D(210, 300, 4.6, 9.2));
    });
});

describe('lineSubdivision', () => {
    test('Subdivide single line', () => {
        const subject: Point[] = [
            new Point(0, 0),
            new Point(40, 0),
            new Point(50, 20),
            new Point(100, 20)
        ];

        const edges = new MockEdgeIterator([
            [new Point(25, 0), new Point(25, 20)],
            [new Point(30, -10), new Point(70, 30)],
            [new Point(75, -20), new Point(75, 40)]
        ]);

        const out: Point[][] = [];
        lineSubdivision(subject, edges, false, out);

        expect(out.length).toEqual(1);
        expect(out[0].length).toEqual(7);

        const line = out[0];
        expect(line[0]).toMatchObject(new Point(0, 0));
        expect(line[1]).toMatchObject(new Point(25, 0));
        expect(line[2]).toMatchObject(new Point(40, 0));
        expect(line[3]).toMatchObject(new Point(50, 20));
        expect(line[4]).toMatchObject(new Point(60, 20));
        expect(line[5]).toMatchObject(new Point(75, 20));
        expect(line[6]).toMatchObject(new Point(100, 20));

    });

    test('Subdivide into separate line segments, simple', () => {
        const subject: Point[] = [
            new Point(0, 0),
            new Point(40, 0),
            new Point(80, 0),
            new Point(120, 0)
        ];

        const edges = new MockEdgeIterator([
            [new Point(20, -20), new Point(20, 20)],
            [new Point(100, -20), new Point(100, 20)]
        ]);

        const out: Point[][] = [];
        lineSubdivision(subject, edges, true, out);

        expect(out.length).toEqual(3);

        expect(out[0]).toMatchObject([new Point(0, 0), new Point(20, 0)]);
        expect(out[1]).toMatchObject([new Point(20, 0), new Point(40, 0), new Point(80, 0), new Point(100, 0)]);
        expect(out[2]).toMatchObject([new Point(100, 0), new Point(120, 0)]);
    });

    test('Subdivide into separate line segments, complex', () => {
        const subject: Point[] = [
            new Point(0, 0),
            new Point(40, 0),
            new Point(50, 20),
            new Point(100, 20)
        ];

        const edges = new MockEdgeIterator([
            [new Point(0, -20), new Point(0, 1000)],
            [new Point(25, 0), new Point(25, 20)],
            [new Point(30, -10), new Point(70, 30)],
            [new Point(75, -20), new Point(75, 40)],
            [new Point(100, -20), new Point(100, 40)]
        ]);

        const out: Point[][] = [];
        lineSubdivision(subject, edges, true, out);

        expect(out.length).toEqual(5);

        expect(out[0].length).toEqual(2);
        expect(out[0]).toMatchObject([new Point(0, 0), new Point(25, 0)]);

        expect(out[1].length).toEqual(2);
        expect(out[1]).toMatchObject([new Point(25, 0), new Point(40, 0)]);

        expect(out[2].length).toEqual(3);
        expect(out[2]).toMatchObject([new Point(40, 0), new Point(50, 20), new Point(60, 20)]);

        expect(out[3].length).toEqual(2);
        expect(out[3]).toMatchObject([new Point(60, 20), new Point(75, 20)]);

        expect(out[4].length).toEqual(2);
        expect(out[4]).toMatchObject([new Point(75, 20), new Point(100, 20)]);
    });

    test('Track progress of subdivided segments in the original line', () => {
        const subject: Point[] = [
            new Point(0, 0),
            new Point(40, 0),
            new Point(50, 20),
            new Point(100, 20)
        ];

        const edges = new MockEdgeIterator([
            [new Point(0, -20), new Point(0, 1000)],
            [new Point(25, 0), new Point(25, 20)],
            [new Point(30, -10), new Point(70, 30)],
            [new Point(75, -20), new Point(75, 40)],
            [new Point(100, -20), new Point(100, 40)]
        ]);

        const expectedProgress: Range[] = [
            {min: 0.0, max: 0.2224},
            {min: 0.2224, max: 0.3559},
            {min: 0.3559, max: 0.6440},
            {min: 0.6440, max: 0.7775},
            {min: 0.7775, max: 1.0}
        ];

        const out: Point[][] = [];
        const progress: Range[] = [];
        lineSubdivision(subject, edges, true, out, progress);

        expect(progress.length).toEqual(expectedProgress.length);

        for (let i = 0; i < expectedProgress.length; i++) {
            const actual = progress[i];
            const expected = expectedProgress[i];
            expect(actual.min).toBeCloseTo(expected.min, 3);
            expect(actual.max).toBeCloseTo(expected.max, 3);
        }
    });
});
