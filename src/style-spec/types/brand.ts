/**
 * Defines nominal type of `U` based on type of `T`. Similar to Opaque types in Flow.
 */
export type Brand<T, U> = T & {__brand: U};
