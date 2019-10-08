import {test} from '../../util/test';
import {CircularBuffer} from '../../../src/util/circular_buffer';

test('CircularBuffer', (t) => {

    t.test('initializes empty', (t) => {
        const buffer = new CircularBuffer(10, () => {});
        t.equal(buffer.count, 0);
        t.end();
    });

    t.test('CircularBuffer#push and pop order', (t) => {
        const buffer = new CircularBuffer(10, () => {});
        buffer.push(1);
        buffer.push(2);
        buffer.push(3);

        t.equal(buffer.pop(), 3);
        t.equal(buffer.pop(), 2);
        t.equal(buffer.pop(), 1);
        t.end();
    });

    t.test('it invokes evictcb with the evicted', (t) => {
        const evicted = [];
        const buffer = new CircularBuffer(4, (e) => { evicted.push(e); });
        buffer.push(1);
        buffer.push(2);
        buffer.push(3);
        buffer.push(4);
        buffer.push(5);
        buffer.push(6);
        buffer.push(7);

        t.equal(evicted[0], 1);
        t.equal(evicted[1], 2);
        t.equal(evicted[2], 3);
        t.end();
    });

    t.test('it tracks count correctly with push and pop', (t) => {
        const buffer = new CircularBuffer(4, () => {});
        buffer.push(1);
        buffer.push(2);
        buffer.push(3);

        t.equal(buffer.count, 3);
        buffer.pop();
        t.equal(buffer.count, 2);
        buffer.push(3);
        buffer.push(4);
        buffer.push(5);
        buffer.push(6);
        // count stays at max, because of evictions
        t.equal(buffer.count, 4);
        t.end();
    });

    t.end();
});
