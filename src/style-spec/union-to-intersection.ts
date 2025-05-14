export type UnionToIntersection<U> =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (U extends any ? (k: U) => void : never) extends (k: infer I) => void ?
    {[K in keyof I]: I[K]} :
    never;
