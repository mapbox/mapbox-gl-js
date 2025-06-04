export type UnionToIntersection<U> =
    (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ?
    {[K in keyof I]: I[K]} :
    never;
