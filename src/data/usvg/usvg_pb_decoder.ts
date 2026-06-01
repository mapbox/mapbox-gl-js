/* eslint-disable camelcase, @stylistic/brace-style */

import Color from "../../style-spec/util/color";

import type {PbfReader} from "pbf";

const defaultColor = new Color(0, 0, 0);

export const PathRule = {
    PATH_RULE_UNSPECIFIED: 0,
    PATH_RULE_NON_ZERO: 1,
    PATH_RULE_EVEN_ODD: 2
} as const;

type PathRuleValue = typeof PathRule[keyof typeof PathRule];

export const LineCap = {
    LINE_CAP_UNSPECIFIED: 0,
    LINE_CAP_BUTT: 1,
    LINE_CAP_ROUND: 2,
    LINE_CAP_SQUARE: 3
} as const;

type LineCapValue = typeof LineCap[keyof typeof LineCap];

export const LineJoin = {
    LINE_JOIN_UNSPECIFIED: 0,
    LINE_JOIN_MITER: 1,
    LINE_JOIN_MITER_CLIP: 2,
    LINE_JOIN_ROUND: 3,
    LINE_JOIN_BEVEL: 4
} as const;

type LineJoinValue = typeof LineJoin[keyof typeof LineJoin];

export const PaintOrder = {
    PAINT_ORDER_UNSPECIFIED: 0,
    PAINT_ORDER_FILL_AND_STROKE: 1,
    PAINT_ORDER_STROKE_AND_FILL: 2
} as const;

type PaintOrderValue = typeof PaintOrder[keyof typeof PaintOrder];

export const PathCommand = {
    PATH_COMMAND_UNSPECIFIED: 0,
    PATH_COMMAND_MOVE: 1,
    PATH_COMMAND_LINE: 2,
    PATH_COMMAND_QUAD: 3,
    PATH_COMMAND_CUBIC: 4,
    PATH_COMMAND_CLOSE: 5
} as const;

type PathCommandValue = typeof PathCommand[keyof typeof PathCommand];

export const SpreadMethod = {
    SPREAD_METHOD_UNSPECIFIED: 0,
    SPREAD_METHOD_PAD: 1,
    SPREAD_METHOD_REFLECT: 2,
    SPREAD_METHOD_REPEAT: 3
} as const;

type SpreadMethodValue = typeof SpreadMethod[keyof typeof SpreadMethod];

export const MaskType = {
    MASK_TYPE_UNSPECIFIED: 0,
    MASK_TYPE_LUMINANCE: 1,
    MASK_TYPE_ALPHA: 2
} as const;

type MaskTypeValue = typeof MaskType[keyof typeof MaskType];

export interface IconSet {
    icons: Icon[];
}

export function readIconSet(pbf: PbfReader, end?: number): IconSet {
    const obj: IconSet = {icons: []};
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) obj.icons.push(readIcon(pbf, pbf.readVarint() + pbf.pos));
    }
    return obj;
}

export function buildStretchedAreas(metadata: {stretch_x?: number[]; stretch_y?: number[]}, axis: "x" | "y"): void {
    const areas: Array<[number, number]> = [];
    const stretch = metadata[`stretch_${axis}`];
    let left: number | null = null;

    for (let i = 0; i < stretch.length; i++) {
        if (left === null) {
            if (areas.length === 0) {
                left = stretch[0];
            } else {
                left = areas.at(-1)[1] + stretch[i];
            }
        } else {
            const right = left + stretch[i];
            areas.push([left, right]);
            left = null;
        }
    }

    metadata[`stretch_${axis}_areas`] = areas;
}

export function postProcessIcon(icon: Icon): Icon {
    if (!icon.usvg_tree.height) {
        icon.usvg_tree.height = icon.usvg_tree.width;
    }

    if (!icon.metadata) {
        return icon;
    }

    const {metadata} = icon;

    if (metadata.content_area) {
        const {content_area: contentArea} = metadata;

        if (contentArea.left == null) {
            contentArea.left = 0;
        }

        if (contentArea.top == null) {
            contentArea.top = contentArea.left;
        }

        if (contentArea.width == null) {
            contentArea.width = icon.usvg_tree.width;
        }

        if (contentArea.height == null) {
            contentArea.height = contentArea.width;
        }
    }

    if (metadata.text_placeholder) {
        const {text_placeholder: textPlaceholder} = metadata;

        if (textPlaceholder.top == null) {
            textPlaceholder.top = textPlaceholder.left;
        }

        if (textPlaceholder.height == null) {
            textPlaceholder.height = textPlaceholder.width;
        }
    }

    if (metadata.stretch_x && metadata.stretch_x.length) {
        buildStretchedAreas(metadata, "x");
    }

    if (metadata.stretch_y && metadata.stretch_y.length) {
        buildStretchedAreas(metadata, "y");
    }

    return icon;
}

export interface Icon {
    name: string;
    metadata?: IconMetadata;
    usvg_tree?: UsvgTree;
    data?: "usvg_tree";
}

export function readIcon(pbf: PbfReader, end?: number): Icon {
    const obj: Icon = {name: undefined};
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) obj.name = pbf.readString();
        else if (field === 2) obj.metadata = readIconMetadata(pbf, pbf.readVarint() + pbf.pos);
        else if (field === 3) { obj.usvg_tree = readUsvgTree(pbf, pbf.readVarint() + pbf.pos); obj.data = "usvg_tree"; }
    }
    return postProcessIcon(obj);
}

export interface IconMetadata {
    stretch_x: number[] | null | undefined;
    stretch_x_areas: [number, number][] | null | undefined;
    stretch_y: number[] | null | undefined;
    stretch_y_areas: [number, number][] | null | undefined;
    content_area?: NonEmptyArea;
    text_placeholder?: NonEmptyArea;
    variables: Variable[];
}

export function readIconMetadata(pbf: PbfReader, end?: number): IconMetadata {
    const obj: IconMetadata = {
        stretch_x: null,
        stretch_y: null,
        stretch_x_areas: null,
        stretch_y_areas: null,
        variables: []
    };
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) obj.stretch_x = pbf.readPackedVarint();
        else if (field === 2) obj.stretch_y = pbf.readPackedVarint();
        else if (field === 3) obj.content_area = readNonEmptyArea(pbf, pbf.readVarint() + pbf.pos);
        else if (field === 4) obj.variables.push(readVariable(pbf, pbf.readVarint() + pbf.pos));
        else if (field === 5) obj.text_placeholder = readNonEmptyArea(pbf, pbf.readVarint() + pbf.pos);
    }
    return obj;
}

export interface NonEmptyArea {
    left: number;
    width: number;
    top: number;
    height: number;
}

export function readNonEmptyArea(pbf: PbfReader, end?: number): NonEmptyArea {
    const obj = {} as NonEmptyArea;
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) obj.left = pbf.readVarint();
        else if (field === 2) obj.width = pbf.readVarint();
        else if (field === 3) obj.top = pbf.readVarint();
        else if (field === 4) obj.height = pbf.readVarint();
    }
    return obj;
}

export interface Variable {
    name: string;
    rgb_color?: Color;
    value?: "rgb_color";
}

export function readVariable(pbf: PbfReader, end?: number): Variable {
    const obj: Variable = {name: undefined};
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) obj.name = pbf.readString();
        else if (field === 2) { obj.rgb_color = readColor(pbf.readVarint()); obj.value = "rgb_color"; }
    }
    return obj;
}

export interface UsvgTree {
    width: number;
    height: number;
    children: Node[];
    linear_gradients: LinearGradient[];
    radial_gradients: RadialGradient[];
    clip_paths: ClipPath[];
    masks: Mask[];
}

export function readUsvgTree(pbf: PbfReader, end?: number): UsvgTree {
    const obj = {width: 20, children: [], linear_gradients: [], radial_gradients: [], clip_paths: [], masks: [], height: 20} as UsvgTree;
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) obj.width = obj.height = pbf.readVarint();
        else if (field === 2) obj.height = pbf.readVarint();
        else if (field === 3) obj.children.push(readNode(pbf, pbf.readVarint() + pbf.pos));
        else if (field === 4) obj.linear_gradients.push(readLinearGradient(pbf, pbf.readVarint() + pbf.pos));
        else if (field === 5) obj.radial_gradients.push(readRadialGradient(pbf, pbf.readVarint() + pbf.pos));
        else if (field === 7) obj.clip_paths.push(readClipPath(pbf, pbf.readVarint() + pbf.pos));
        else if (field === 8) obj.masks.push(readMask(pbf, pbf.readVarint() + pbf.pos));
    }
    return obj;
}

export interface Node {
    group?: Group;
    path?: Path;
    node?: "group" | "path";
}

export function readNode(pbf: PbfReader, end?: number): Node {
    const obj: Node = {};
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) { obj.group = readGroup(pbf, pbf.readVarint() + pbf.pos); obj.node = "group"; }
        else if (field === 2) { obj.path = readPath(pbf, pbf.readVarint() + pbf.pos); obj.node = "path"; }
    }
    return obj;
}

export interface Group {
    transform?: Transform;
    opacity?: number;
    clip_path_idx?: number;
    mask_idx?: number;
    children: Node[];
}

export function readGroup(pbf: PbfReader, end?: number): Group {
    const obj: Group = {opacity: 255, children: []};
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) obj.transform = readTransform(pbf, pbf.readVarint() + pbf.pos);
        else if (field === 2) obj.opacity = pbf.readVarint();
        else if (field === 5) obj.clip_path_idx = pbf.readVarint();
        else if (field === 6) obj.mask_idx = pbf.readVarint();
        else if (field === 7) obj.children.push(readNode(pbf, pbf.readVarint() + pbf.pos));
    }
    return obj;
}

export interface Transform {
    sx?: number;
    ky?: number;
    kx?: number;
    sy?: number;
    tx?: number;
    ty?: number;
}

export function readTransform(pbf: PbfReader, end?: number): Transform {
    const obj: Transform = {sx: 1, ky: 0, kx: 0, sy: 1, tx: 0, ty: 0};
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) obj.sx = pbf.readFloat();
        else if (field === 2) obj.ky = pbf.readFloat();
        else if (field === 3) obj.kx = pbf.readFloat();
        else if (field === 4) obj.sy = pbf.readFloat();
        else if (field === 5) obj.tx = pbf.readFloat();
        else if (field === 6) obj.ty = pbf.readFloat();
    }
    return obj;
}

export interface Path {
    fill?: Fill;
    stroke?: Stroke;
    paint_order?: PaintOrderValue;
    commands: PathCommandValue[];
    step?: number;
    diffs: number[];
    rule?: PathRuleValue;
}

export function readPath(pbf: PbfReader, end?: number): Path {
    const obj: Path = {paint_order: 1, commands: [], step: 1, diffs: [], rule: PathRule.PATH_RULE_NON_ZERO};
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) obj.fill = readFill(pbf, pbf.readVarint() + pbf.pos);
        else if (field === 2) obj.stroke = readStroke(pbf, pbf.readVarint() + pbf.pos);
        else if (field === 3) obj.paint_order = pbf.readVarint() as PaintOrderValue;
        else if (field === 5) pbf.readPackedVarint(obj.commands);
        else if (field === 6) obj.step = pbf.readFloat();
        else if (field === 7) pbf.readPackedSVarint(obj.diffs);
        else if (field === 8) obj.rule = pbf.readVarint() as PathRuleValue;
    }
    return obj;
}

export interface Fill {
    rgb_color?: Color;
    linear_gradient_idx?: number;
    radial_gradient_idx?: number;
    opacity?: number;
    paint?: "rgb_color" | "linear_gradient_idx" | "radial_gradient_idx";
}

export function readFill(pbf: PbfReader, end?: number): Fill {
    const obj: Fill = {rgb_color: defaultColor, paint: "rgb_color", opacity: 255};
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) { obj.rgb_color = readColor(pbf.readVarint()); obj.paint = "rgb_color"; }
        else if (field === 2) { obj.linear_gradient_idx = pbf.readVarint(); obj.paint = "linear_gradient_idx"; }
        else if (field === 3) { obj.radial_gradient_idx = pbf.readVarint(); obj.paint = "radial_gradient_idx"; }
        else if (field === 5) obj.opacity = pbf.readVarint();
    }
    return obj;
}

export interface Stroke {
    rgb_color?: Color;
    linear_gradient_idx?: number;
    radial_gradient_idx?: number;
    dasharray: number[];
    dashoffset?: number;
    miterlimit?: number;
    opacity?: number;
    width?: number;
    linecap?: LineCapValue;
    linejoin?: LineJoinValue;
    paint?: "rgb_color" | "linear_gradient_idx" | "radial_gradient_idx";
}

export function readStroke(pbf: PbfReader, end?: number): Stroke {
    const obj: Stroke = {rgb_color: defaultColor, paint: "rgb_color", dasharray: [], dashoffset: 0, miterlimit: 4, opacity: 255, width: 1, linecap: 1, linejoin: 1};
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) { obj.rgb_color = readColor(pbf.readVarint()); obj.paint = "rgb_color"; }
        else if (field === 2) { obj.linear_gradient_idx = pbf.readVarint(); obj.paint = "linear_gradient_idx"; }
        else if (field === 3) { obj.radial_gradient_idx = pbf.readVarint(); obj.paint = "radial_gradient_idx"; }
        else if (field === 5) pbf.readPackedFloat(obj.dasharray);
        else if (field === 6) obj.dashoffset = pbf.readFloat();
        else if (field === 7) obj.miterlimit = pbf.readFloat();
        else if (field === 8) obj.opacity = pbf.readVarint();
        else if (field === 9) obj.width = pbf.readFloat();
        else if (field === 10) obj.linecap = pbf.readVarint() as LineCapValue;
        else if (field === 11) obj.linejoin = pbf.readVarint() as LineJoinValue;
    }
    return obj;
}

export function readColor(number: number): Color {
    return new Color(((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255, 1);
}

export interface LinearGradient {
    transform?: Transform;
    spread_method?: SpreadMethodValue;
    stops: Stop[];
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
}

export function readLinearGradient(pbf: PbfReader, end?: number): LinearGradient {
    const obj: LinearGradient = {spread_method: 1, stops: [], x1: 0, y1: 0, x2: 1, y2: 0};
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) obj.transform = readTransform(pbf, pbf.readVarint() + pbf.pos);
        else if (field === 2) obj.spread_method = pbf.readVarint() as SpreadMethodValue;
        else if (field === 3) obj.stops.push(readStop(pbf, pbf.readVarint() + pbf.pos));
        else if (field === 4) obj.x1 = pbf.readFloat();
        else if (field === 5) obj.y1 = pbf.readFloat();
        else if (field === 6) obj.x2 = pbf.readFloat();
        else if (field === 7) obj.y2 = pbf.readFloat();
    }
    return obj;
}

export interface Stop {
    offset?: number;
    opacity?: number;
    rgb_color?: Color;
}

export function readStop(pbf: PbfReader, end?: number): Stop {
    const obj: Stop = {offset: 0, opacity: 255, rgb_color: defaultColor};
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) obj.offset = pbf.readFloat();
        else if (field === 2) obj.opacity = pbf.readVarint();
        else if (field === 3) obj.rgb_color = readColor(pbf.readVarint());
    }
    return obj;
}

export interface RadialGradient {
    transform?: Transform;
    spread_method?: SpreadMethodValue;
    stops: Stop[];
    cx?: number;
    cy?: number;
    r?: number;
    fx?: number;
    fy?: number;
    fr?: number;
}

export function readRadialGradient(pbf: PbfReader, end?: number): RadialGradient {
    const obj: RadialGradient = {spread_method: 1, stops: [], cx: 0.5, cy: 0.5, r: 0.5, fx: 0.5, fy: 0.5, fr: 0};
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) obj.transform = readTransform(pbf, pbf.readVarint() + pbf.pos);
        else if (field === 2) obj.spread_method = pbf.readVarint() as SpreadMethodValue;
        else if (field === 3) obj.stops.push(readStop(pbf, pbf.readVarint() + pbf.pos));
        else if (field === 4) obj.cx = pbf.readFloat();
        else if (field === 5) obj.cy = pbf.readFloat();
        else if (field === 6) obj.r = pbf.readFloat();
        else if (field === 7) obj.fx = pbf.readFloat();
        else if (field === 8) obj.fy = pbf.readFloat();
        else if (field === 9) obj.fr = pbf.readFloat();
    }
    return obj;
}

export interface ClipPath {
    transform?: Transform;
    clip_path_idx?: number;
    children: Node[];
}

export function readClipPath(pbf: PbfReader, end?: number): ClipPath {
    const obj: ClipPath = {children: []};
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) obj.transform = readTransform(pbf, pbf.readVarint() + pbf.pos);
        else if (field === 2) obj.clip_path_idx = pbf.readVarint();
        else if (field === 3) obj.children.push(readNode(pbf, pbf.readVarint() + pbf.pos));
    }
    return obj;
}

export interface Mask {
    left?: number;
    width?: number;
    top?: number;
    height?: number;
    mask_type?: MaskTypeValue;
    mask_idx?: number;
    children: Node[];
}

export function readMask(pbf: PbfReader, end?: number): Mask {
    const mask: Mask = {left: 0, width: 20, mask_type: MaskType.MASK_TYPE_LUMINANCE, children: []};
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) mask.left = mask.top = pbf.readFloat();
        else if (field === 2) mask.width = mask.height = pbf.readFloat();
        else if (field === 3) mask.top = pbf.readFloat();
        else if (field === 4) mask.height = pbf.readFloat();
        else if (field === 5) mask.mask_type = pbf.readVarint() as MaskTypeValue;
        else if (field === 6) mask.mask_idx = pbf.readVarint();
        else if (field === 7) mask.children.push(readNode(pbf, pbf.readVarint() + pbf.pos));
    }

    if (mask.height == null) {
        mask.height = mask.width;
    }

    if (mask.top == null) {
        mask.top = mask.left;
    }

    return mask;
}
