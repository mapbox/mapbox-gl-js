// @flow

import assert from 'assert';
import {
    charHasUprightVerticalOrientation,
    charAllowsIdeographicBreaking,
    charInComplexShapingScript
} from '../util/script_detection';
import verticalizePunctuation from '../util/verticalize_punctuation';
import {plugin as rtlTextPlugin} from '../source/rtl_text_plugin';
import ONE_EM from './one_em';
import {warnOnce} from '../util/util';

import type {StyleGlyph, GlyphMetrics} from '../style/style_glyph';
import {GLYPH_PBF_BORDER} from '../style/parse_glyph_pbf';
import type {ImagePosition} from '../render/image_atlas';
import {IMAGE_PADDING} from '../render/image_atlas';
import type {Rect, GlyphPosition} from '../render/glyph_atlas';
import Formatted, {FormattedSection} from '../style-spec/expression/types/formatted';

const WritingMode = {
    horizontal: 1,
    vertical: 2,
    horizontalOnly: 3
};

const SHAPING_DEFAULT_OFFSET = -17;
export {shapeText, shapeIcon, fitIconToText, getAnchorAlignment, WritingMode, SHAPING_DEFAULT_OFFSET};

// The position of a glyph relative to the text's anchor point.
export type PositionedGlyph = {
    glyph: number,
    imageName: string | null,
    x: number,
    y: number,
    vertical: boolean,
    scale: number,
    fontStack: string,
    sectionIndex: number,
    metrics: GlyphMetrics,
    rect: Rect | null
};

export type PositionedLine = {
    positionedGlyphs: Array<PositionedGlyph>,
    lineOffset: number
};

// A collection of positioned glyphs and some metadata
export type Shaping = {
    positionedLines: Array<PositionedLine>,
    top: number,
    bottom: number,
    left: number,
    right: number,
    writingMode: 1 | 2,
    text: string,
    iconsInText: boolean,
    verticalizable: boolean
};

function isEmpty(positionedLines: Array<PositionedLine>) {
    for (const line of positionedLines) {
        if (line.positionedGlyphs.length !== 0) {
            return false;
        }
    }
    return true;
}

export type SymbolAnchor = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type TextJustify = 'left' | 'center' | 'right';

// Max number of images in label is 6401 U+E000–U+F8FF that covers
// Basic Multilingual Plane Unicode Private Use Area (PUA).
const PUAbegin = 0xE000;
const PUAend = 0xF8FF;

class SectionOptions {
    // Text options
    scale: number;
    fontStack: string;
    // Image options
    imageName: string | null;

    constructor() {
        this.scale = 1.0;
        this.fontStack = "";
        this.imageName = null;
    }

    static forText(scale: number | null, fontStack: string) {
        const textOptions = new SectionOptions();
        textOptions.scale = scale || 1;
        textOptions.fontStack = fontStack;
        return textOptions;
    }

    static forImage(imageName: string) {
        const imageOptions = new SectionOptions();
        imageOptions.imageName = imageName;
        return imageOptions;
    }

}

class TaggedString {
    text: string;
    sectionIndex: Array<number> // maps each character in 'text' to its corresponding entry in 'sections'
    sections: Array<SectionOptions>
    imageSectionID: number | null;

    constructor() {
        this.text = "";
        this.sectionIndex = [];
        this.sections = [];
        this.imageSectionID = null;
    }

    static fromFeature(text: Formatted, defaultFontStack: string) {
        const result = new TaggedString();
        for (let i = 0; i < text.sections.length; i++) {
            const section = text.sections[i];
            if (!section.image) {
                result.addTextSection(section, defaultFontStack);
            } else {
                result.addImageSection(section);
            }
        }
        return result;
    }

    length(): number {
        return this.text.length;
    }

    getSection(index: number): SectionOptions {
        return this.sections[this.sectionIndex[index]];
    }

    getSectionIndex(index: number): number {
        return this.sectionIndex[index];
    }

    getCharCode(index: number): number {
        return this.text.charCodeAt(index);
    }

    verticalizePunctuation() {
        this.text = verticalizePunctuation(this.text);
    }

    trim() {
        let beginningWhitespace = 0;
        for (let i = 0;
            i < this.text.length && whitespace[this.text.charCodeAt(i)];
            i++) {
            beginningWhitespace++;
        }
        let trailingWhitespace = this.text.length;
        for (let i = this.text.length - 1;
            i >= 0 && i >= beginningWhitespace && whitespace[this.text.charCodeAt(i)];
            i--) {
            trailingWhitespace--;
        }
        this.text = this.text.substring(beginningWhitespace, trailingWhitespace);
        this.sectionIndex = this.sectionIndex.slice(beginningWhitespace, trailingWhitespace);
    }

    substring(start: number, end: number): TaggedString {
        const substring = new TaggedString();
        substring.text = this.text.substring(start, end);
        substring.sectionIndex = this.sectionIndex.slice(start, end);
        substring.sections = this.sections;
        return substring;
    }

    toString(): string {
        return this.text;
    }

    getMaxScale() {
        return this.sectionIndex.reduce((max, index) => Math.max(max, this.sections[index].scale), 0);
    }

    addTextSection(section: FormattedSection, defaultFontStack: string) {
        this.text += section.text;
        this.sections.push(SectionOptions.forText(section.scale, section.fontStack || defaultFontStack));
        const index = this.sections.length - 1;
        for (let i = 0; i < section.text.length; ++i) {
            this.sectionIndex.push(index);
        }
    }

    addImageSection(section: FormattedSection) {
        const imageName = section.image ? section.image.name : '';
        if (imageName.length === 0) {
            warnOnce(`Can't add FormattedSection with an empty image.`);
            return;
        }

        const nextImageSectionCharCode = this.getNextImageSectionCharCode();
        if (!nextImageSectionCharCode) {
            warnOnce(`Reached maximum number of images ${PUAend - PUAbegin + 2}`);
            return;
        }

        this.text += String.fromCharCode(nextImageSectionCharCode);
        this.sections.push(SectionOptions.forImage(imageName));
        this.sectionIndex.push(this.sections.length - 1);
    }

    getNextImageSectionCharCode(): number | null {
        if (!this.imageSectionID) {
            this.imageSectionID = PUAbegin;
            return this.imageSectionID;
        }

        if (this.imageSectionID >= PUAend) return null;
        return ++this.imageSectionID;
    }
}

function breakLines(input: TaggedString, lineBreakPoints: Array<number>): Array<TaggedString> {
    const lines = [];
    const text = input.text;
    let start = 0;
    for (const lineBreak of lineBreakPoints) {
        lines.push(input.substring(start, lineBreak));
        start = lineBreak;
    }

    if (start < text.length) {
        lines.push(input.substring(start, text.length));
    }
    return lines;
}

function shapeText(text: Formatted,
                   glyphMap: {[string]: {[number]: ?StyleGlyph}},
                   glyphPositions: {[string]: {[number]: GlyphPosition}},
                   imagePositions: {[string]: ImagePosition},
                   defaultFontStack: string,
                   maxWidth: number,
                   lineHeight: number,
                   textAnchor: SymbolAnchor,
                   textJustify: TextJustify,
                   spacing: number,
                   translate: [number, number],
                   writingMode: 1 | 2,
                   allowVerticalPlacement: boolean,
                   symbolPlacement: string,
                   layoutTextSize: number,
                   layoutTextSizeThisZoom: number): Shaping | false {
    const logicalInput = TaggedString.fromFeature(text, defaultFontStack);

    if (writingMode === WritingMode.vertical) {
        logicalInput.verticalizePunctuation();
    }

    let lines: Array<TaggedString>;

    const {processBidirectionalText, processStyledBidirectionalText} = rtlTextPlugin;
    if (processBidirectionalText && logicalInput.sections.length === 1) {
        // Bidi doesn't have to be style-aware
        lines = [];
        const untaggedLines =
            processBidirectionalText(logicalInput.toString(),
                                     determineLineBreaks(logicalInput, spacing, maxWidth, glyphMap, imagePositions, symbolPlacement, layoutTextSize));
        for (const line of untaggedLines) {
            const taggedLine = new TaggedString();
            taggedLine.text = line;
            taggedLine.sections = logicalInput.sections;
            for (let i = 0; i < line.length; i++) {
                taggedLine.sectionIndex.push(0);
            }
            lines.push(taggedLine);
        }
    } else if (processStyledBidirectionalText) {
        // Need version of mapbox-gl-rtl-text with style support for combining RTL text
        // with formatting
        lines = [];
        const processedLines =
            processStyledBidirectionalText(logicalInput.text,
                                           logicalInput.sectionIndex,
                                           determineLineBreaks(logicalInput, spacing, maxWidth, glyphMap, imagePositions, symbolPlacement, layoutTextSize));
        for (const line of processedLines) {
            const taggedLine = new TaggedString();
            taggedLine.text = line[0];
            taggedLine.sectionIndex = line[1];
            taggedLine.sections = logicalInput.sections;
            lines.push(taggedLine);
        }
    } else {
        lines = breakLines(logicalInput, determineLineBreaks(logicalInput, spacing, maxWidth, glyphMap, imagePositions, symbolPlacement, layoutTextSize));
    }

    const positionedLines = [];
    const shaping = {
        positionedLines,
        text: logicalInput.toString(),
        top: translate[1],
        bottom: translate[1],
        left: translate[0],
        right: translate[0],
        writingMode,
        iconsInText: false,
        verticalizable: false
    };

    shapeLines(shaping, glyphMap, glyphPositions, imagePositions, lines, lineHeight, textAnchor, textJustify, writingMode, spacing, allowVerticalPlacement, layoutTextSizeThisZoom);
    if (isEmpty(positionedLines)) return false;

    return shaping;
}

// using computed properties due to https://github.com/facebook/flow/issues/380
/* eslint no-useless-computed-key: 0 */

const whitespace: {[number]: boolean} = {
    [0x09]: true, // tab
    [0x0a]: true, // newline
    [0x0b]: true, // vertical tab
    [0x0c]: true, // form feed
    [0x0d]: true, // carriage return
    [0x20]: true, // space
};

const breakable: {[number]: boolean} = {
    [0x0a]:   true, // newline
    [0x20]:   true, // space
    [0x26]:   true, // ampersand
    [0x28]:   true, // left parenthesis
    [0x29]:   true, // right parenthesis
    [0x2b]:   true, // plus sign
    [0x2d]:   true, // hyphen-minus
    [0x2f]:   true, // solidus
    [0xad]:   true, // soft hyphen
    [0xb7]:   true, // middle dot
    [0x200b]: true, // zero-width space
    [0x2010]: true, // hyphen
    [0x2013]: true, // en dash
    [0x2027]: true  // interpunct
    // Many other characters may be reasonable breakpoints
    // Consider "neutral orientation" characters at scriptDetection.charHasNeutralVerticalOrientation
    // See https://github.com/mapbox/mapbox-gl-js/issues/3658
};

function getGlyphAdvance(codePoint: number,
                         section: SectionOptions,
                         glyphMap: {[string]: {[number]: ?StyleGlyph}},
                         imagePositions: {[string]: ImagePosition},
                         spacing: number,
                         layoutTextSize: number): number {
    if (!section.imageName) {
        const positions = glyphMap[section.fontStack];
        const glyph = positions && positions[codePoint];
        if (!glyph) return 0;
        return glyph.metrics.advance * section.scale + spacing;
    } else {
        const imagePosition = imagePositions[section.imageName];
        if (!imagePosition) return 0;
        return imagePosition.displaySize[0] * section.scale * ONE_EM / layoutTextSize + spacing;
    }
}

function determineAverageLineWidth(logicalInput: TaggedString,
                                   spacing: number,
                                   maxWidth: number,
                                   glyphMap: {[string]: {[number]: ?StyleGlyph}},
                                   imagePositions: {[string]: ImagePosition},
                                   layoutTextSize: number) {
    let totalWidth = 0;

    for (let index = 0; index < logicalInput.length(); index++) {
        const section = logicalInput.getSection(index);
        totalWidth += getGlyphAdvance(logicalInput.getCharCode(index), section, glyphMap, imagePositions, spacing, layoutTextSize);
    }

    const lineCount = Math.max(1, Math.ceil(totalWidth / maxWidth));
    return totalWidth / lineCount;
}

function calculateBadness(lineWidth: number,
                          targetWidth: number,
                          penalty: number,
                          isLastBreak: boolean) {
    const raggedness = Math.pow(lineWidth - targetWidth, 2);
    if (isLastBreak) {
        // Favor finals lines shorter than average over longer than average
        if (lineWidth < targetWidth) {
            return raggedness / 2;
        } else {
            return raggedness * 2;
        }
    }

    return raggedness + Math.abs(penalty) * penalty;
}

function calculatePenalty(codePoint: number, nextCodePoint: number, penalizableIdeographicBreak: boolean) {
    let penalty = 0;
    // Force break on newline
    if (codePoint === 0x0a) {
        penalty -= 10000;
    }
    // Penalize breaks between characters that allow ideographic breaking because
    // they are less preferable than breaks at spaces (or zero width spaces).
    if (penalizableIdeographicBreak) {
        penalty += 150;
    }

    // Penalize open parenthesis at end of line
    if (codePoint === 0x28 || codePoint === 0xff08) {
        penalty += 50;
    }

    // Penalize close parenthesis at beginning of line
    if (nextCodePoint === 0x29 || nextCodePoint === 0xff09) {
        penalty += 50;
    }
    return penalty;
}

type Break = {
    index: number,
    x: number,
    priorBreak: ?Break,
    badness: number
};

function evaluateBreak(breakIndex: number,
                       breakX: number,
                       targetWidth: number,
                       potentialBreaks: Array<Break>,
                       penalty: number,
                       isLastBreak: boolean): Break {
    // We could skip evaluating breaks where the line length (breakX - priorBreak.x) > maxWidth
    //  ...but in fact we allow lines longer than maxWidth (if there's no break points)
    //  ...and when targetWidth and maxWidth are close, strictly enforcing maxWidth can give
    //     more lopsided results.

    let bestPriorBreak: ?Break = null;
    let bestBreakBadness = calculateBadness(breakX, targetWidth, penalty, isLastBreak);

    for (const potentialBreak of potentialBreaks) {
        const lineWidth = breakX - potentialBreak.x;
        const breakBadness =
            calculateBadness(lineWidth, targetWidth, penalty, isLastBreak) + potentialBreak.badness;
        if (breakBadness <= bestBreakBadness) {
            bestPriorBreak = potentialBreak;
            bestBreakBadness = breakBadness;
        }
    }

    return {
        index: breakIndex,
        x: breakX,
        priorBreak: bestPriorBreak,
        badness: bestBreakBadness
    };
}

function leastBadBreaks(lastLineBreak: ?Break): Array<number> {
    if (!lastLineBreak) {
        return [];
    }
    return leastBadBreaks(lastLineBreak.priorBreak).concat(lastLineBreak.index);
}

function determineLineBreaks(logicalInput: TaggedString,
                             spacing: number,
                             maxWidth: number,
                             glyphMap: {[string]: {[number]: ?StyleGlyph}},
                             imagePositions: {[string]: ImagePosition},
                             symbolPlacement: string,
                             layoutTextSize: number): Array<number> {
    if (symbolPlacement !== 'point')
        return [];

    if (!logicalInput)
        return [];

    const potentialLineBreaks = [];
    const targetWidth = determineAverageLineWidth(logicalInput, spacing, maxWidth, glyphMap, imagePositions, layoutTextSize);

    const hasServerSuggestedBreakpoints = logicalInput.text.indexOf("\u200b") >= 0;

    let currentX = 0;

    for (let i = 0; i < logicalInput.length(); i++) {
        const section = logicalInput.getSection(i);
        const codePoint = logicalInput.getCharCode(i);
        if (!whitespace[codePoint]) currentX += getGlyphAdvance(codePoint, section, glyphMap, imagePositions, spacing, layoutTextSize);

        // Ideographic characters, spaces, and word-breaking punctuation that often appear without
        // surrounding spaces.
        if ((i < logicalInput.length() - 1)) {
            const ideographicBreak = charAllowsIdeographicBreaking(codePoint);
            if (breakable[codePoint] || ideographicBreak || section.imageName) {

                potentialLineBreaks.push(
                    evaluateBreak(
                        i + 1,
                        currentX,
                        targetWidth,
                        potentialLineBreaks,
                        calculatePenalty(codePoint, logicalInput.getCharCode(i + 1), ideographicBreak && hasServerSuggestedBreakpoints),
                        false));
            }
        }
    }

    return leastBadBreaks(
        evaluateBreak(
            logicalInput.length(),
            currentX,
            targetWidth,
            potentialLineBreaks,
            0,
            true));
}

function getAnchorAlignment(anchor: SymbolAnchor) {
    let horizontalAlign = 0.5, verticalAlign = 0.5;

    switch (anchor) {
    case 'right':
    case 'top-right':
    case 'bottom-right':
        horizontalAlign = 1;
        break;
    case 'left':
    case 'top-left':
    case 'bottom-left':
        horizontalAlign = 0;
        break;
    }

    switch (anchor) {
    case 'bottom':
    case 'bottom-right':
    case 'bottom-left':
        verticalAlign = 1;
        break;
    case 'top':
    case 'top-right':
    case 'top-left':
        verticalAlign = 0;
        break;
    }

    return {horizontalAlign, verticalAlign};
}

function shapeLines(shaping: Shaping,
                    glyphMap: {[string]: {[number]: ?StyleGlyph}},
                    glyphPositions: {[string]: {[number]: GlyphPosition}},
                    imagePositions: {[string]: ImagePosition},
                    lines: Array<TaggedString>,
                    lineHeight: number,
                    textAnchor: SymbolAnchor,
                    textJustify: TextJustify,
                    writingMode: 1 | 2,
                    spacing: number,
                    allowVerticalPlacement: boolean,
                    layoutTextSizeThisZoom: number) {

    let x = 0;
    let y = SHAPING_DEFAULT_OFFSET;

    let maxLineLength = 0;
    let maxLineHeight = 0;

    const justify =
        textJustify === 'right' ? 1 :
        textJustify === 'left' ? 0 : 0.5;

    let lineIndex = 0;
    for (const line of lines) {
        line.trim();

        const lineMaxScale = line.getMaxScale();
        const maxLineOffset = (lineMaxScale - 1) * ONE_EM;
        const positionedLine = {positionedGlyphs: [], lineOffset: 0};
        shaping.positionedLines[lineIndex] = positionedLine;
        const positionedGlyphs = positionedLine.positionedGlyphs;
        let lineOffset = 0.0;

        if (!line.length()) {
            y += lineHeight; // Still need a line feed after empty line
            ++lineIndex;
            continue;
        }

        for (let i = 0; i < line.length(); i++) {
            const section = line.getSection(i);
            const sectionIndex = line.getSectionIndex(i);
            const codePoint = line.getCharCode(i);
            let baselineOffset = 0.0;
            let metrics = null;
            let rect = null;
            let imageName = null;
            let verticalAdvance = ONE_EM;
            const vertical = !(writingMode === WritingMode.horizontal ||
                // Don't verticalize glyphs that have no upright orientation if vertical placement is disabled.
                (!allowVerticalPlacement && !charHasUprightVerticalOrientation(codePoint)) ||
                // If vertical placement is enabled, don't verticalize glyphs that
                // are from complex text layout script, or whitespaces.
                (allowVerticalPlacement && (whitespace[codePoint] || charInComplexShapingScript(codePoint))));

            if (!section.imageName) {
                const positions = glyphPositions[section.fontStack];
                const glyphPosition = positions && positions[codePoint];
                if (glyphPosition && glyphPosition.rect) {
                    rect = glyphPosition.rect;
                    metrics = glyphPosition.metrics;
                } else {
                    const glyphs = glyphMap[section.fontStack];
                    const glyph = glyphs && glyphs[codePoint];
                    if (!glyph) continue;
                    metrics = glyph.metrics;
                }

                // We don't know the baseline, but since we're laying out
                // at 24 points, we can calculate how much it will move when
                // we scale up or down.
                baselineOffset = (lineMaxScale - section.scale) * ONE_EM;
            } else {
                const imagePosition = imagePositions[section.imageName];
                if (!imagePosition) continue;
                imageName = section.imageName;
                shaping.iconsInText = shaping.iconsInText || true;
                rect = imagePosition.paddedRect;
                const size = imagePosition.displaySize;
                // If needed, allow to set scale factor for an image using
                // alias "image-scale" that could be alias for "font-scale"
                // when FormattedSection is an image section.
                section.scale = section.scale * ONE_EM / layoutTextSizeThisZoom;

                metrics = {width: size[0],
                    height: size[1],
                    left: IMAGE_PADDING,
                    top: -GLYPH_PBF_BORDER,
                    advance: vertical ? size[1] : size[0]};

                // Difference between one EM and an image size.
                // Aligns bottom of an image to a baseline level.
                const imageOffset = ONE_EM - size[1] * section.scale;
                baselineOffset = maxLineOffset + imageOffset;
                verticalAdvance = metrics.advance;

                // Difference between height of an image and one EM at max line scale.
                // Pushes current line down if an image size is over 1 EM at max line scale.
                const offset = vertical ? size[0] * section.scale - ONE_EM * lineMaxScale :
                    size[1] * section.scale - ONE_EM * lineMaxScale;
                if (offset > 0 && offset > lineOffset) {
                    lineOffset = offset;
                }
            }

            if (!vertical) {
                positionedGlyphs.push({glyph: codePoint, imageName, x, y: y + baselineOffset, vertical, scale: section.scale, fontStack: section.fontStack, sectionIndex, metrics, rect});
                x += metrics.advance * section.scale + spacing;
            } else {
                shaping.verticalizable = true;
                positionedGlyphs.push({glyph: codePoint, imageName, x, y: y + baselineOffset, vertical, scale: section.scale, fontStack: section.fontStack, sectionIndex, metrics, rect});
                x += verticalAdvance * section.scale + spacing;
            }
        }

        // Only justify if we placed at least one glyph
        if (positionedGlyphs.length !== 0) {
            const lineLength = x - spacing;
            maxLineLength = Math.max(lineLength, maxLineLength);
            justifyLine(positionedGlyphs, 0, positionedGlyphs.length - 1, justify, lineOffset);
        }

        x = 0;
        const currentLineHeight = lineHeight * lineMaxScale + lineOffset;
        positionedLine.lineOffset = Math.max(lineOffset, maxLineOffset);
        y += currentLineHeight;
        maxLineHeight = Math.max(currentLineHeight, maxLineHeight);
        ++lineIndex;
    }

    // Calculate the bounding box and justify / align text block.
    const height = y - SHAPING_DEFAULT_OFFSET;
    const {horizontalAlign, verticalAlign} = getAnchorAlignment(textAnchor);
    align(shaping.positionedLines, justify, horizontalAlign, verticalAlign, maxLineLength, maxLineHeight, lineHeight, height, lines.length);

    shaping.top += -verticalAlign * height;
    shaping.bottom = shaping.top + height;
    shaping.left += -horizontalAlign * maxLineLength;
    shaping.right = shaping.left + maxLineLength;
}

// justify right = 1, left = 0, center = 0.5
function justifyLine(positionedGlyphs: Array<PositionedGlyph>,
                     start: number,
                     end: number,
                     justify: 1 | 0 | 0.5,
                     lineOffset: number) {
    if (!justify && !lineOffset)
        return;

    const lastPositionedGlyph = positionedGlyphs[end];
    const lastAdvance = lastPositionedGlyph.metrics.advance * lastPositionedGlyph.scale;
    const lineIndent = (positionedGlyphs[end].x + lastAdvance) * justify;

    for (let j = start; j <= end; j++) {
        positionedGlyphs[j].x -= lineIndent;
        positionedGlyphs[j].y += lineOffset;
    }
}

function align(positionedLines: Array<PositionedLine>,
               justify: number,
               horizontalAlign: number,
               verticalAlign: number,
               maxLineLength: number,
               maxLineHeight: number,
               lineHeight: number,
               blockHeight: number,
               lineCount: number) {
    const shiftX = (justify - horizontalAlign) * maxLineLength;
    let shiftY = 0;

    if (maxLineHeight !== lineHeight) {
        shiftY = -blockHeight * verticalAlign - SHAPING_DEFAULT_OFFSET;
    } else {
        shiftY = (-verticalAlign * lineCount + 0.5) * lineHeight;
    }

    for (const line of positionedLines) {
        for (const positionedGlyph of line.positionedGlyphs) {
            positionedGlyph.x += shiftX;
            positionedGlyph.y += shiftY;
        }
    }
}

export type PositionedIcon = {
    image: ImagePosition,
    top: number,
    bottom: number,
    left: number,
    right: number,
    collisionPadding?: [number, number, number, number]
};

function shapeIcon(image: ImagePosition, iconOffset: [number, number], iconAnchor: SymbolAnchor): PositionedIcon {
    const {horizontalAlign, verticalAlign} = getAnchorAlignment(iconAnchor);
    const dx = iconOffset[0];
    const dy = iconOffset[1];
    const x1 = dx - image.displaySize[0] * horizontalAlign;
    const x2 = x1 + image.displaySize[0];
    const y1 = dy - image.displaySize[1] * verticalAlign;
    const y2 = y1 + image.displaySize[1];
    return {image, top: y1, bottom: y2, left: x1, right: x2};
}

function fitIconToText(shapedIcon: PositionedIcon, shapedText: Shaping,
                       textFit: string,
                       padding: [ number, number, number, number ],
                       iconOffset: [ number, number ], fontScale: number): PositionedIcon {
    assert(textFit !== 'none');
    assert(Array.isArray(padding) && padding.length === 4);
    assert(Array.isArray(iconOffset) && iconOffset.length === 2);

    const image = shapedIcon.image;

    let collisionPadding;
    if (image.content) {
        const content = image.content;
        const pixelRatio = image.pixelRatio || 1;
        collisionPadding = [
            content[0] / pixelRatio,
            content[1] / pixelRatio,
            image.displaySize[0] - content[2] / pixelRatio,
            image.displaySize[1] - content[3] / pixelRatio
        ];
    }

    // We don't respect the icon-anchor, because icon-text-fit is set. Instead,
    // the icon will be centered on the text, then stretched in the given
    // dimensions.

    const textLeft = shapedText.left * fontScale;
    const textRight = shapedText.right * fontScale;

    let top, right, bottom, left;
    if (textFit === 'width' || textFit === 'both') {
        // Stretched horizontally to the text width
        left = iconOffset[0] + textLeft - padding[3];
        right = iconOffset[0] + textRight + padding[1];
    } else {
        // Centered on the text
        left = iconOffset[0] + (textLeft + textRight - image.displaySize[0]) / 2;
        right = left + image.displaySize[0];
    }

    const textTop = shapedText.top * fontScale;
    const textBottom = shapedText.bottom * fontScale;
    if (textFit === 'height' || textFit === 'both') {
        // Stretched vertically to the text height
        top = iconOffset[1] + textTop - padding[0];
        bottom = iconOffset[1] + textBottom + padding[2];
    } else {
        // Centered on the text
        top = iconOffset[1] + (textTop + textBottom - image.displaySize[1]) / 2;
        bottom = top + image.displaySize[1];
    }

    return {image, top, right, bottom, left, collisionPadding};
}
