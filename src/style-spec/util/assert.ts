export default function assert(condition: unknown, message?: string): asserts condition {
    if (!condition) throw new Error(message !== undefined ? message : 'Assertion failed');
}
