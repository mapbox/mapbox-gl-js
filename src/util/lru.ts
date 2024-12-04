export class LRUCache<T = object> {
    private capacity: number;
    private cache: Map<string, T>;
    /**
     * @param {number} capacity - max size of cache
     */
    constructor(capacity: number) {
        this.capacity = capacity;
        this.cache = new Map();
    }

    get(key: string): T | undefined {
        if (!this.cache.has(key)) return undefined;
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    put(key: string, value: T): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size === this.capacity) {
            this.cache.delete(this.cache.keys().next().value);
        }
        this.cache.set(key, value);
    }

    delete(key: string): void {
        this.cache.delete(key);
    }
}
