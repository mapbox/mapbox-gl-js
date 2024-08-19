export type UnionToIntersection<U> =
    (U extends any ? (k: U) => void : never) extends (k: infer I) => void ?
    {[K in keyof I]: I[K]} :
    never;
