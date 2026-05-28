import type {Transferable} from '../types/transferable';

type GridItem<K> = {key: K; x1: number; y1: number; x2: number; y2: number};

type IntArray = Array<number> | Int32Array;
type CellArray = Array<IntArray | null>;
type KeyArray<K> = Array<K> | Int32Array;
type KeyPredicate<K> = (key: K) => boolean;

const HEADER_LEN = 6;

/**
 * 2D spatial index for axis-aligned boxes and circles. Splits the plane into
 * cells; full geometry checks happen only on items that share a cell with the
 * query, so as long as items are reasonably uniformly distributed, queries are
 * fast. Supports `toArrayBuffer` / `ArrayBuffer` constructor for transfer
 * across worker boundaries; once deserialized, the grid is read-only.
 *
 * @private
 */
class GridIndex<K = number> {
    width: number;
    height: number;
    xCellCount: number;
    yCellCount: number;
    xScale: number;
    yScale: number;

    boxKeys: KeyArray<K>;
    circleKeys: KeyArray<K>;
    boxCells: CellArray;
    circleCells: CellArray;
    bboxes: IntArray;
    circles: IntArray;
    boxUid: number;
    circleUid: number;

    // Per-uid "seen this query" tracking via a rolling generation counter
    // (avoids allocating a fresh dedup map for every query).
    boxSeen: Uint32Array;
    circleSeen: Uint32Array;
    generation: number;

    constructor(width: number | ArrayBuffer, height?: number, cellSize?: number) {
        this.boxSeen = new Uint32Array(0);
        this.circleSeen = new Uint32Array(0);
        this.generation = 0;

        if (width instanceof ArrayBuffer) {
            const a = new Int32Array(width);
            this.width = a[0];
            this.height = a[1];
            this.xCellCount = a[2];
            this.yCellCount = a[3];
            this.boxUid = a[4];
            this.circleUid = a[5];

            const nCells = this.xCellCount * this.yCellCount;
            const boxCells: CellArray = [];
            for (let i = 0; i < nCells; i++) {
                const start = a[HEADER_LEN + i];
                const end = a[HEADER_LEN + i + 1];
                boxCells.push(start === end ? null : a.subarray(start, end));
            }
            const circleTable = a[HEADER_LEN + nCells];
            const circleCells: CellArray = [];
            for (let i = 0; i < nCells; i++) {
                const start = a[circleTable + i];
                const end = a[circleTable + i + 1];
                circleCells.push(start === end ? null : a.subarray(start, end));
            }
            let offset = a[circleTable + nCells];
            this.boxCells = boxCells;
            this.circleCells = circleCells;
            this.boxKeys = a.subarray(offset, offset + this.boxUid);
            offset += this.boxUid;
            this.circleKeys = a.subarray(offset, offset + this.circleUid);
            offset += this.circleUid;
            this.bboxes = a.subarray(offset, offset + this.boxUid * 4);
            offset += this.boxUid * 4;
            this.circles = a.subarray(offset, offset + this.circleUid * 3);
        } else {
            this.width = width;
            this.height = height;
            this.xCellCount = Math.ceil(width / cellSize);
            this.yCellCount = Math.ceil(height / cellSize);

            const nCells = this.xCellCount * this.yCellCount;
            const boxCells: CellArray = [];
            const circleCells: CellArray = [];
            for (let i = 0; i < nCells; i++) {
                boxCells.push([]);
                circleCells.push([]);
            }
            this.boxCells = boxCells;
            this.circleCells = circleCells;
            this.boxKeys = [];
            this.circleKeys = [];
            this.bboxes = [];
            this.circles = [];
            this.boxUid = 0;
            this.circleUid = 0;
        }
        this.xScale = this.xCellCount / this.width;
        this.yScale = this.yCellCount / this.height;
    }

    keysLength(): number {
        return this.boxKeys.length + this.circleKeys.length;
    }

    clear() {
        for (const cell of this.boxCells) if (cell) (cell as Array<number>).length = 0;
        for (const cell of this.circleCells) if (cell) (cell as Array<number>).length = 0;
        (this.circleKeys as Array<K>).length = 0;
        (this.boxKeys as Array<K>).length = 0;
        (this.bboxes as Array<number>).length = 0;
        (this.circles as Array<number>).length = 0;
        this.boxUid = 0;
        this.circleUid = 0;
    }

    insert(key: K, x1: number, y1: number, x2: number, y2: number) {
        const uid = this.boxUid++;
        const cx1 = this._xCell(x1), cy1 = this._yCell(y1);
        const cx2 = this._xCell(x2), cy2 = this._yCell(y2);
        for (let cx = cx1; cx <= cx2; cx++) {
            for (let cy = cy1; cy <= cy2; cy++) {
                (this.boxCells[this.xCellCount * cy + cx] as Array<number>).push(uid);
            }
        }
        (this.boxKeys as Array<K>).push(key);
        (this.bboxes as Array<number>).push(x1, y1, x2, y2);
    }

    insertCircle(key: K, x: number, y: number, radius: number) {
        // Insert into all cells in the circumscribing square. More than
        // necessary (by 4/PI) but fast.
        const uid = this.circleUid++;
        const cx1 = this._xCell(x - radius), cy1 = this._yCell(y - radius);
        const cx2 = this._xCell(x + radius), cy2 = this._yCell(y + radius);
        for (let cx = cx1; cx <= cx2; cx++) {
            for (let cy = cy1; cy <= cy2; cy++) {
                (this.circleCells[this.xCellCount * cy + cx] as Array<number>).push(uid);
            }
        }
        (this.circleKeys as Array<K>).push(key);
        (this.circles as Array<number>).push(x, y, radius);
    }

    query(x1: number, y1: number, x2: number, y2: number, predicate?: KeyPredicate<K>): Array<GridItem<K>> {
        const result: Array<GridItem<K>> = [];
        if (x2 < 0 || x1 > this.width || y2 < 0 || y1 > this.height) return result;
        const gen = this._nextGen();
        const {boxCells, circleCells, boxKeys, circleKeys, bboxes, circles, boxSeen, circleSeen, xCellCount} = this;

        const cx1 = this._xCell(x1), cy1 = this._yCell(y1);
        const cx2 = this._xCell(x2), cy2 = this._yCell(y2);
        for (let cx = cx1; cx <= cx2; cx++) {
            for (let cy = cy1; cy <= cy2; cy++) {
                const ci = xCellCount * cy + cx;
                const bc = boxCells[ci];
                if (bc) {
                    for (let i = 0; i < bc.length; i++) {
                        const uid = bc[i];
                        if (boxSeen[uid] === gen) continue;
                        boxSeen[uid] = gen;
                        const o = uid * 4;
                        const bx1 = bboxes[o], by1 = bboxes[o + 1], bx2 = bboxes[o + 2], by2 = bboxes[o + 3];
                        if (x1 <= bx2 && y1 <= by2 && x2 >= bx1 && y2 >= by1 &&
                            (!predicate || predicate(boxKeys[uid] as K))) {
                            result.push({key: boxKeys[uid] as K, x1: bx1, y1: by1, x2: bx2, y2: by2});
                        }
                    }
                }
                const cc = circleCells[ci];
                if (cc) {
                    for (let i = 0; i < cc.length; i++) {
                        const uid = cc[i];
                        if (circleSeen[uid] === gen) continue;
                        circleSeen[uid] = gen;
                        const o = uid * 3;
                        const x = circles[o], y = circles[o + 1], r = circles[o + 2];
                        if (this._circleAndRectCollide(x, y, r, x1, y1, x2, y2) &&
                            (!predicate || predicate(circleKeys[uid] as K))) {
                            result.push({key: circleKeys[uid] as K, x1: x - r, y1: y - r, x2: x + r, y2: y + r});
                        }
                    }
                }
            }
        }
        return result;
    }

    // Box-only query returning a flat array of keys. The optional
    // bbox-predicate is used to skip whole cells whose bounds don't intersect
    // the query shape, then re-applied to each candidate's stored bbox in
    // place of the simple AABB overlap test.
    queryKeys(x1: number, y1: number, x2: number, y2: number, predicate?: (x1: number, y1: number, x2: number, y2: number) => boolean): Array<number> {
        const result: Array<number> = [];
        if (x2 < 0 || x1 > this.width || y2 < 0 || y1 > this.height) return result;
        const gen = this._nextGen();
        const {boxCells, boxKeys, bboxes, boxSeen, xCellCount, xScale, yScale} = this;

        const cx1 = this._xCell(x1), cy1 = this._yCell(y1);
        const cx2 = this._xCell(x2), cy2 = this._yCell(y2);
        for (let cx = cx1; cx <= cx2; cx++) {
            for (let cy = cy1; cy <= cy2; cy++) {
                if (predicate && !predicate(cx / xScale, cy / yScale, (cx + 1) / xScale, (cy + 1) / yScale)) continue;
                const bc = boxCells[xCellCount * cy + cx];
                if (!bc) continue;
                for (let i = 0; i < bc.length; i++) {
                    const uid = bc[i];
                    if (boxSeen[uid] === gen) continue;
                    boxSeen[uid] = gen;
                    const o = uid * 4;
                    const bx1 = bboxes[o], by1 = bboxes[o + 1], bx2 = bboxes[o + 2], by2 = bboxes[o + 3];
                    if (predicate ? predicate(bx1, by1, bx2, by2) :
                        (x1 <= bx2 && y1 <= by2 && x2 >= bx1 && y2 >= by1)) {
                        result.push(boxKeys[uid] as number);
                    }
                }
            }
        }
        return result;
    }

    hitTest(x1: number, y1: number, x2: number, y2: number, predicate?: KeyPredicate<K>): boolean {
        if (x2 < 0 || x1 > this.width || y2 < 0 || y1 > this.height) return false;
        const gen = this._nextGen();
        const {boxCells, circleCells, boxKeys, circleKeys, bboxes, circles, boxSeen, circleSeen, xCellCount} = this;

        const cx1 = this._xCell(x1), cy1 = this._yCell(y1);
        const cx2 = this._xCell(x2), cy2 = this._yCell(y2);
        for (let cx = cx1; cx <= cx2; cx++) {
            for (let cy = cy1; cy <= cy2; cy++) {
                const ci = xCellCount * cy + cx;
                const bc = boxCells[ci];
                if (bc) {
                    for (let i = 0; i < bc.length; i++) {
                        const uid = bc[i];
                        if (boxSeen[uid] === gen) continue;
                        boxSeen[uid] = gen;
                        const o = uid * 4;
                        if (x1 <= bboxes[o + 2] && y1 <= bboxes[o + 3] && x2 >= bboxes[o] && y2 >= bboxes[o + 1] &&
                            (!predicate || predicate(boxKeys[uid] as K))) return true;
                    }
                }
                const cc = circleCells[ci];
                if (cc) {
                    for (let i = 0; i < cc.length; i++) {
                        const uid = cc[i];
                        if (circleSeen[uid] === gen) continue;
                        circleSeen[uid] = gen;
                        const o = uid * 3;
                        if (this._circleAndRectCollide(circles[o], circles[o + 1], circles[o + 2], x1, y1, x2, y2) &&
                            (!predicate || predicate(circleKeys[uid] as K))) return true;
                    }
                }
            }
        }
        return false;
    }

    hitTestCircle(x: number, y: number, radius: number, predicate?: KeyPredicate<K>): boolean {
        const x1 = x - radius, y1 = y - radius;
        const x2 = x + radius, y2 = y + radius;
        if (x2 < 0 || x1 > this.width || y2 < 0 || y1 > this.height) return false;
        const gen = this._nextGen();
        const {boxCells, circleCells, boxKeys, circleKeys, bboxes, circles, boxSeen, circleSeen, xCellCount} = this;

        const cx1 = this._xCell(x1), cy1 = this._yCell(y1);
        const cx2 = this._xCell(x2), cy2 = this._yCell(y2);
        for (let cx = cx1; cx <= cx2; cx++) {
            for (let cy = cy1; cy <= cy2; cy++) {
                const ci = xCellCount * cy + cx;
                const bc = boxCells[ci];
                if (bc) {
                    for (let i = 0; i < bc.length; i++) {
                        const uid = bc[i];
                        if (boxSeen[uid] === gen) continue;
                        boxSeen[uid] = gen;
                        const o = uid * 4;
                        if (this._circleAndRectCollide(x, y, radius, bboxes[o], bboxes[o + 1], bboxes[o + 2], bboxes[o + 3]) &&
                            (!predicate || predicate(boxKeys[uid] as K))) return true;
                    }
                }
                const cc = circleCells[ci];
                if (cc) {
                    for (let i = 0; i < cc.length; i++) {
                        const uid = cc[i];
                        if (circleSeen[uid] === gen) continue;
                        circleSeen[uid] = gen;
                        const o = uid * 3;
                        if (this._circlesCollide(circles[o], circles[o + 1], circles[o + 2], x, y, radius) &&
                            (!predicate || predicate(circleKeys[uid] as K))) return true;
                    }
                }
            }
        }
        return false;
    }

    static serialize(grid: GridIndex<number>, transferables?: Set<Transferable>): {buffer: ArrayBuffer} {
        const buffer = grid.toArrayBuffer();
        if (transferables) transferables.add(buffer);
        return {buffer};
    }

    static deserialize(serialized: {buffer: ArrayBuffer}): GridIndex<number> {
        return new GridIndex<number>(serialized.buffer);
    }

    toArrayBuffer(): ArrayBuffer {
        const nCells = this.xCellCount * this.yCellCount;
        let totalBox = 0, totalCircle = 0;
        for (let i = 0; i < nCells; i++) {
            totalBox += this.boxCells[i].length;
            totalCircle += this.circleCells[i].length;
        }
        const totalLen =
            HEADER_LEN +
            (nCells + 1) + totalBox +
            (nCells + 1) + totalCircle +
            this.boxUid + this.circleUid +
            this.boxUid * 4 + this.circleUid * 3;

        const a = new Int32Array(totalLen);
        a[0] = this.width;
        a[1] = this.height;
        a[2] = this.xCellCount;
        a[3] = this.yCellCount;
        a[4] = this.boxUid;
        a[5] = this.circleUid;

        let offset = HEADER_LEN + (nCells + 1);
        for (let i = 0; i < nCells; i++) {
            a[HEADER_LEN + i] = offset;
            const cell = this.boxCells[i] as Array<number>;
            a.set(cell, offset);
            offset += cell.length;
        }
        a[HEADER_LEN + nCells] = offset;

        const circleTable = offset;
        offset += nCells + 1;
        for (let i = 0; i < nCells; i++) {
            a[circleTable + i] = offset;
            const cell = this.circleCells[i] as Array<number>;
            a.set(cell, offset);
            offset += cell.length;
        }
        a[circleTable + nCells] = offset;

        a.set(this.boxKeys as unknown as number[], offset);
        offset += this.boxUid;
        a.set(this.circleKeys as unknown as number[], offset);
        offset += this.circleUid;
        a.set(this.bboxes, offset);
        offset += this.boxUid * 4;
        a.set(this.circles, offset);

        return a.buffer;
    }

    _xCell(x: number): number {
        return Math.max(0, Math.min(this.xCellCount - 1, Math.floor(x * this.xScale)));
    }

    _yCell(y: number): number {
        return Math.max(0, Math.min(this.yCellCount - 1, Math.floor(y * this.yScale)));
    }

    _nextGen(): number {
        if (this.boxSeen.length < this.boxUid) this.boxSeen = new Uint32Array(this.boxUid);
        if (this.circleSeen.length < this.circleUid) this.circleSeen = new Uint32Array(this.circleUid);
        this.generation = (this.generation + 1) >>> 0;
        if (this.generation === 0) {
            this.boxSeen.fill(0);
            this.circleSeen.fill(0);
            this.generation = 1;
        }
        return this.generation;
    }

    _circlesCollide(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const r = r1 + r2;
        return r * r > dx * dx + dy * dy;
    }

    _circleAndRectCollide(cx: number, cy: number, r: number, x1: number, y1: number, x2: number, y2: number): boolean {
        const halfW = (x2 - x1) / 2;
        const distX = Math.abs(cx - (x1 + halfW));
        if (distX > halfW + r) return false;

        const halfH = (y2 - y1) / 2;
        const distY = Math.abs(cy - (y1 + halfH));
        if (distY > halfH + r) return false;

        if (distX <= halfW || distY <= halfH) return true;

        const dx = distX - halfW;
        const dy = distY - halfH;
        return dx * dx + dy * dy <= r * r;
    }
}

export default GridIndex;
