// @flow
type VecType = Array<number> | Float32Array | Float64Array;

declare module "gl-matrix" {
    declare type Vec2 = VecType;
    declare type Vec3 = VecType;
    declare type Vec4 = VecType;
    declare type Quat = VecType;
    declare type Mat2 = VecType;
    declare type Mat3 = VecType;
    declare type Mat4 = VecType;

    declare var vec2: {
        exactEquals(Vec2, Vec2): boolean
    };

    declare var vec3: {
        create(): Float32Array,
        fromValues(number, number, number): Float32Array,
        length(Vec3): number,
        len(Vec3): number,
        squaredLength(Vec3): number,
        dot(Vec3, Vec3): number,
        equals(Vec3, Vec3): boolean,
        exactEquals(Vec3, Vec3): boolean,

        clone<T: Vec3>(T): T,
        normalize<T: Vec3>(T, Vec3): T,
        add<T: Vec3>(T, Vec3, Vec3): T,
        sub<T: Vec3>(T, Vec3, Vec3): T,
        subtract<T: Vec3>(T, Vec3, Vec3): T,
        cross<T: Vec3>(T, Vec3, Vec3): T,
        negate<T: Vec3>(T, Vec3): T,
        scale<T: Vec3>(T, Vec3, number): T,
        scaleAndAdd<T: Vec3>(T, Vec3, Vec3, number): T,
        multiply<T: Vec3>(T, Vec3, Vec3): T,
        mul<T: Vec3>(T, Vec3, Vec3): T,
        div<T: Vec3>(T, Vec3, Vec3): T,
        min<T: Vec3>(T, Vec3, Vec3): T,
        max<T: Vec3>(T, Vec3, Vec3): T,
        lerp<T: Vec3>(T, Vec3, Vec3, number): T,
        transformQuat<T: Vec3>(T, Vec3, Quat): T,
        transformMat3<T: Vec3>(T, Vec3, Mat3): T,
        transformMat4<T: Vec3>(T, Vec3, Mat4): T
    };

    declare var vec4: {
        scale<T: Vec4>(T, Vec4, number): T,
        mul<T: Vec4>(T, Vec4, Vec4): T,
        transformMat4<T: Vec4>(T, Vec4, Mat4): T
    };

    declare var mat2: {
        create(): Float32Array,
        rotate<T: Mat2>(T, Mat2, number): T,
        invert<T: Mat2>(T, Mat2): T,
        scale<T: Mat2>(T, Mat2, Vec2): T
    };

    declare var mat3: {
        create(): Float32Array,

        fromMat4<T: Mat3>(T, Mat4): T,
        fromRotation<T: Mat3>(T, number): T,
        mul<T: Mat3>(T, Mat3, Mat3): T,
        multiply<T: Mat3>(T, Mat3, Mat3): T,
        adjoint<T: Mat3>(T, Mat3): T,
        transpose<T: Mat3>(T, Mat3): T
    };

    declare var mat4: {
        create(): Float32Array,

        fromScaling<T: Mat4>(T, Vec3): T,
        fromQuat<T: Mat4>(T, Quat): T,
        ortho<T: Mat4>(T, number, number, number, number, number, number): T,
        perspective<T: Mat4>(T, number, number, number, number): T,
        identity<T: Mat4>(T): T,
        scale<T: Mat4>(T, Mat4, Vec3): T,
        mul<T: Mat4>(T, Mat4, Mat4): T,
        multiply<T: Mat4>(T, Mat4, Mat4): T,
        rotateX<T: Mat4>(T, Mat4, number): T,
        rotateY<T: Mat4>(T, Mat4, number): T,
        rotateZ<T: Mat4>(T, Mat4, number): T,
        translate<T: Mat4>(T, Mat4, Vec3): T,
        invert<T: Mat4>(T, Mat4): T,
        copy<T: Mat4>(T, Mat4): T,
        clone<T: Mat4>(T): T
    };

    declare var quat: {
        create(): Float32Array,
        length(Quat): number,
        exactEquals(Quat, Quat): boolean,

        normalize<T: Quat>(T, Quat): T,
        conjugate<T: Quat>(T, Quat): T,
        identity<T: Quat>(T): T,
        rotateX<T: Quat>(T, Quat, number): T,
        rotateY<T: Quat>(T, Quat, number): T,
        rotateZ<T: Quat>(T, Quat, number): T
    }
}
