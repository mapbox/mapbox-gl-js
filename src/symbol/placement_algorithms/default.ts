import Point from '@mapbox/point-geometry';
import assert from '../../style-spec/util/assert';
import {mat4, vec4} from 'gl-matrix';
import {clamp, warnOnce} from '../../util/util';
import CollisionIndex from '../collision_index';
import ONE_EM from '../one_em';
import {WritingMode} from '../shaping';
import {evaluateSizeForFeature} from '../symbol_size';
import {Elevation} from '../../terrain/elevation';
import toEvaluationFeature from '../../data/evaluation_feature';
import {
    JointPlacement,
    CollisionCircleArray,
    calculateVariableLayoutShift,
    offsetShift,
    markUsedJustification,
    markUsedOrientation,
} from '../placement';

import type {PlacementAlgorithm, CollisionDetector} from '../placement_algorithm';
import type Transform from '../../geo/transform';
import type {FogState} from '../../style/fog_helpers';
import type SymbolBucket from '../../data/bucket/symbol_bucket';
import type {SingleCollisionBox, CollisionArrays} from '../../data/bucket/symbol_bucket';
import type {SymbolInstance} from '../../data/array_types';
import type {BucketPart, CollisionGroup, Placement} from '../placement';
import type {Orientation} from '../shaping';
import type {TextAnchor} from '../symbol_layout';
import type {InterpolatedSize} from '../symbol_size';
import type {PlacedCollisionBox, PlacedCollisionCircles} from '../collision_index';
import type {Feature} from '../../style-spec/expression/index';

export class DefaultPlacementAlgorithm implements PlacementAlgorithm {
    createCollisionDetector(transform: Transform, fogState?: FogState | null, prevCollisionDetector?: CollisionDetector | null): CollisionDetector {
        if (prevCollisionDetector instanceof CollisionIndex) {
            prevCollisionDetector.reset(transform, fogState);
            return prevCollisionDetector;
        }
        return new CollisionIndex(transform, fogState);
    }

    shouldPause(elapsedMs: number): boolean {
        return elapsedMs > 2;
    }

    placeLayerBucketPart(
        placement: Placement,
        bucketPart: BucketPart,
        seenCrossTileIDs: Set<number>,
        showCollisionBoxes: boolean,
        updateCollisionBoxIfNecessary: boolean,
        scaleFactor: number = 1,
    ): void {
        const {
            bucket,
            layout,
            paint,
            posMatrix,
            textLabelPlaneMatrix,
            labelToScreenMatrix,
            clippingData,
            textPixelRatio,
            mercatorCenter,
            invMatrix,
            holdingForFade,
            collisionBoxArray,
            partiallyEvaluatedTextSize,
            partiallyEvaluatedIconSize,
            collisionGroup,
            latestFeatureIndex
        } = bucketPart.parameters;

        const textOptional = layout.get('text-optional');
        const iconOptional = layout.get('icon-optional');
        const textAllowOverlap = layout.get('text-allow-overlap');
        const iconAllowOverlap = layout.get('icon-allow-overlap');
        const textRotateWithMap = layout.get('text-rotation-alignment') === 'map';
        const iconRotateWithMap = layout.get('icon-rotation-alignment') === 'map';
        const pitchWithMap = layout.get('text-pitch-alignment') === 'map';
        const symbolZOffset = paint.get('symbol-z-offset');
        const elevationFromSea = layout.get('symbol-elevation-reference') === 'sea';
        const symbolPlacement = layout.get('symbol-placement');
        const [textSizeScaleRangeMin, textSizeScaleRangeMax] = layout.get('text-size-scale-range');
        const [iconSizeScaleRangeMin, iconSizeScaleRangeMax] = layout.get('icon-size-scale-range');
        const textScaleFactor = clamp(scaleFactor, textSizeScaleRangeMin, textSizeScaleRangeMax);
        const iconScaleFactor = clamp(scaleFactor, iconSizeScaleRangeMin, iconSizeScaleRangeMax);
        const textVariableAnchor = layout.get('text-variable-anchor');

        const isTextPlacedAlongLine = textRotateWithMap && symbolPlacement !== 'point';
        const isIconPlacedAlongLine = iconRotateWithMap && symbolPlacement !== 'point';

        const hasVariableAnchors = textVariableAnchor && bucket.hasTextData();
        const updateTextFitIcon = bucket.hasIconTextFit() && hasVariableAnchors && bucket.hasIconData();

        placement.transform.setProjection(bucket.projection);

        const textProjectedPosOnLabelSpace = hasVariableAnchors || isTextPlacedAlongLine;
        const iconProjectedPosOnLabelSpace = isIconPlacedAlongLine || updateTextFitIcon;

        let alwaysShowText = textAllowOverlap && (iconAllowOverlap || !bucket.hasIconData() || iconOptional);
        let alwaysShowIcon = iconAllowOverlap && (textAllowOverlap || !bucket.hasTextData() || textOptional);

        const needsFeatureForElevation = !symbolZOffset.isConstant();

        if (!bucket.collisionArrays && collisionBoxArray) {
            bucket.deserializeCollisionBoxes(collisionBoxArray);
        }

        if (showCollisionBoxes && updateCollisionBoxIfNecessary) {
            bucket.updateCollisionDebugBuffers(placement.transform.zoom, collisionBoxArray, textScaleFactor, iconScaleFactor);
        }

        const placeSymbol = (symbolInstance: SymbolInstance, boxIndex: number, collisionArrays: CollisionArrays) => {
            const {crossTileID, numVerticalGlyphVertices} = symbolInstance;

            let feature: Feature = null;

            if ((clippingData && clippingData.dynamicFilterNeedsFeature) || needsFeatureForElevation) {
                const retainedQueryData = placement.retainedQueryData[bucket.bucketInstanceId];
                const vtFeature = latestFeatureIndex.loadFeature({
                    featureIndex: symbolInstance.featureIndex,
                    bucketIndex: retainedQueryData.bucketIndex,
                    sourceLayerIndex: retainedQueryData.sourceLayerIndex,
                    layoutVertexArrayOffset: 0
                });

                const worldview = vtFeature.properties ? vtFeature.properties.worldview : null;
                if (bucket.localizable && bucket.worldview && typeof worldview === 'string') {
                    if (worldview === 'all') {
                        vtFeature.properties['$localized'] = true;
                    } else if (worldview.split(',').includes(bucket.worldview)) {
                        vtFeature.properties['$localized'] = true;
                        vtFeature.properties['worldview'] = bucket.worldview;
                    } else {
                        return;
                    }
                }

                feature = (clippingData && clippingData.needGeometry) ? toEvaluationFeature(vtFeature, true) : vtFeature;
            }

            if (clippingData) {
                const globals = {
                    zoom: placement.transform.zoom,
                    pitch: placement.transform.pitch,
                    worldview: bucket.worldview
                };
                const canonicalTileId = placement.retainedQueryData[bucket.bucketInstanceId].tileID.canonical;
                const filterFunc = clippingData.dynamicFilter;
                const shouldClip = !filterFunc(globals, feature, canonicalTileId, new Point(symbolInstance.tileAnchorX, symbolInstance.tileAnchorY), placement.transform.calculateDistanceTileData(clippingData.unwrappedTileID));

                if (shouldClip) {
                    placement.placements[crossTileID] = new JointPlacement(false, false, false, true);
                    seenCrossTileIDs.add(crossTileID);
                    return;
                }
            }

            const symbolZOffsetValue = symbolZOffset.evaluate(feature, {});

            const totalZOffset = (symbolInstance.zOffset || 0) + (symbolZOffsetValue || 0);
            if (totalZOffset > 0 && placement.frontCutoffStart > 0) {
                const threshold = placement.frontCutoffStart * 2.0 - 1.0;
                const groundPos = [symbolInstance.tileAnchorX, symbolInstance.tileAnchorY, 0, 1] as [number, number, number, number];
                const projected = vec4.transformMat4(vec4.create(), groundPos, posMatrix);
                const ndcY = projected[1] / projected[3];
                if (ndcY < threshold) {
                    placement.placements[crossTileID] = new JointPlacement(false, false, false, true);
                    seenCrossTileIDs.add(crossTileID);
                    return;
                }
            }

            if (seenCrossTileIDs.has(crossTileID)) return;
            if (holdingForFade) {
                placement.placements[crossTileID] = new JointPlacement(false, false, false);
                return;
            }
            let placeText: boolean | null | undefined = false;
            let placeIcon: boolean | null | undefined = false;
            let offscreen: boolean | null | undefined = true;
            let textOccluded: boolean | null | undefined = false;
            let iconOccluded = false;

            let shift: Point = null;

            let placed: Partial<PlacedCollisionBox> = {box: null, offscreen: null, occluded: null};
            let placedVerticalText: Partial<PlacedCollisionBox> = {box: null, offscreen: null, occluded: null};

            let placedGlyphBoxes: Partial<PlacedCollisionBox> = null;
            let placedGlyphCircles: Partial<PlacedCollisionCircles> = null;
            let placedIconBoxes: Partial<PlacedCollisionBox> = null;
            let textFeatureIndex = 0;
            let verticalTextFeatureIndex = 0;
            let iconFeatureIndex = 0;

            if (collisionArrays.textFeatureIndex) {
                textFeatureIndex = collisionArrays.textFeatureIndex;
            } else if (symbolInstance.useRuntimeCollisionCircles) {
                textFeatureIndex = symbolInstance.featureIndex;
            }
            if (collisionArrays.verticalTextFeatureIndex) {
                verticalTextFeatureIndex = collisionArrays.verticalTextFeatureIndex;
            }

            const elevationFeature = bucket.hdExt ? bucket.hdExt.elevationFeatures[symbolInstance.elevationFeatureIndex] : undefined;

            const updateBoxData = (box: SingleCollisionBox) => {
                box.tileID = placement.retainedQueryData[bucket.bucketInstanceId].tileID;
                const elevation = placement.transform.elevation;
                box.elevation = (elevationFromSea ? symbolZOffsetValue : symbolZOffsetValue + (Elevation.getAtTileOffset(box.tileID, new Point(box.tileAnchorX, box.tileAnchorY), elevation, elevationFeature)));
                box.elevation += symbolInstance.zOffset;
            };

            const textBox = collisionArrays.textBox;
            if (textBox) {
                updateBoxData(textBox);
                const updatePreviousOrientationIfNotPlaced = (isPlaced: boolean) => {
                    let previousOrientation: Orientation = WritingMode.horizontal;

                    if (bucket.allowVerticalPlacement && !isPlaced && placement.prevPlacement) {
                        const prevPlacedOrientation = placement.prevPlacement.placedOrientations[crossTileID];
                        if (prevPlacedOrientation) {
                            placement.placedOrientations[crossTileID] = prevPlacedOrientation;
                            previousOrientation = prevPlacedOrientation;
                            markUsedOrientation(bucket, previousOrientation, symbolInstance);
                        }
                    }
                    return previousOrientation;
                };

                const placeTextForPlacementModes = (placeHorizontalFn: () => Partial<PlacedCollisionBox>, placeVerticalFn: () => Partial<PlacedCollisionBox>) => {
                    if (bucket.allowVerticalPlacement && numVerticalGlyphVertices > 0 && collisionArrays.verticalTextBox) {
                        for (const placementMode of bucket.writingModes) {
                            if (placementMode === WritingMode.vertical) {
                                placed = placeVerticalFn();
                                placedVerticalText = placed;
                            } else {
                                placed = placeHorizontalFn();
                            }
                            if (placed && placed.box && placed.box.length) break;
                        }
                    } else {
                        placed = placeHorizontalFn();
                    }
                };

                if (!textVariableAnchor) {
                    const placeBox = (collisionTextBox: SingleCollisionBox, orientation: Orientation) => {
                        const textScale = bucket.getSymbolInstanceTextSize(partiallyEvaluatedTextSize, symbolInstance, placement.transform.zoom, boxIndex);
                        const placedFeature = placement.collisionIndex.placeCollisionBox(bucket, textScale, collisionTextBox, mercatorCenter, invMatrix, textProjectedPosOnLabelSpace,
                            new Point(0, 0), textAllowOverlap, textPixelRatio, posMatrix, collisionGroup.predicate);
                        if (placedFeature && placedFeature.box && placedFeature.box.length) {
                            markUsedOrientation(bucket, orientation, symbolInstance);
                            placement.placedOrientations[crossTileID] = orientation;
                        }
                        return placedFeature;
                    };

                    const placeHorizontal: () => PlacedCollisionBox = () => {
                        return placeBox(textBox, WritingMode.horizontal);
                    };

                    const placeVertical: () => PlacedCollisionBox | Partial<PlacedCollisionBox> = () => {
                        const verticalTextBox = collisionArrays.verticalTextBox;
                        if (bucket.allowVerticalPlacement && numVerticalGlyphVertices > 0 && verticalTextBox) {
                            updateBoxData(verticalTextBox);
                            return placeBox(verticalTextBox, WritingMode.vertical);
                        }
                        return {box: null, offscreen: null, occluded: null};
                    };

                    placeTextForPlacementModes(
                        (placeHorizontal),
                        (placeVertical),
                    );

                    const isPlaced = placed && placed.box && placed.box.length;
                    updatePreviousOrientationIfNotPlaced(!!isPlaced);

                } else {
                    let anchors = textVariableAnchor;

                    if (placement.prevPlacement && placement.prevPlacement.variableOffsets[crossTileID]) {
                        const prevOffsets = placement.prevPlacement.variableOffsets[crossTileID];
                        if (anchors.indexOf(prevOffsets.anchor) > 0) {
                            anchors = anchors.filter(anchor => anchor !== prevOffsets.anchor);
                            anchors.unshift(prevOffsets.anchor);
                        }
                    }

                    const placeBoxForVariableAnchors = (collisionTextBox: SingleCollisionBox, collisionIconBox: SingleCollisionBox | null | undefined, orientation: Orientation) => {
                        const textScale = bucket.getSymbolInstanceTextSize(partiallyEvaluatedTextSize, symbolInstance, placement.transform.zoom, boxIndex);
                        const width = (collisionTextBox.x2 - collisionTextBox.x1) * textScale + 2.0 * collisionTextBox.padding;
                        const height = (collisionTextBox.y2 - collisionTextBox.y1) * textScale + 2.0 * collisionTextBox.padding;

                        const variableIconBox = symbolInstance.hasIconTextFit && !iconAllowOverlap ? collisionIconBox : null;
                        if (variableIconBox) updateBoxData(variableIconBox);

                        let placedBox: Partial<PlacedCollisionBox> = {box: [], offscreen: false, occluded: false};

                        const placementAttempts = textAllowOverlap ? anchors.length * 2 : anchors.length;
                        for (let i = 0; i < placementAttempts; ++i) {
                            const anchor = anchors[i % anchors.length];
                            const allowOverlap = (i >= anchors.length);
                            const result = this.attemptAnchorPlacement(
                                placement, anchor, collisionTextBox, mercatorCenter, invMatrix, textProjectedPosOnLabelSpace, width, height, textScale, textRotateWithMap,
                                pitchWithMap, textPixelRatio, posMatrix, collisionGroup, allowOverlap,
                                symbolInstance, boxIndex, bucket, orientation, variableIconBox,
                                partiallyEvaluatedTextSize, partiallyEvaluatedIconSize);

                            if (result) {
                                placedBox = (result.placedGlyphBoxes);
                                if (placedBox && placedBox.box && placedBox.box.length) {
                                    placeText = true;
                                    shift = result.shift;
                                    break;
                                }
                            }
                        }

                        return placedBox;
                    };

                    const placeHorizontal = () => {
                        return placeBoxForVariableAnchors(textBox, collisionArrays.iconBox, WritingMode.horizontal);
                    };

                    const placeVertical = () => {
                        const verticalTextBox = collisionArrays.verticalTextBox;
                        if (verticalTextBox) updateBoxData(verticalTextBox);
                        const wasPlaced = placed && placed.box && placed.box.length;
                        if (bucket.allowVerticalPlacement && !wasPlaced && numVerticalGlyphVertices > 0 && verticalTextBox) {
                            return placeBoxForVariableAnchors(verticalTextBox, collisionArrays.verticalIconBox, WritingMode.vertical);
                        }
                        return {box: null, offscreen: null, occluded: null};
                    };

                    placeTextForPlacementModes(placeHorizontal, placeVertical);

                    if (placed) {
                        placeText = placed.box as unknown as boolean;
                        offscreen = placed.offscreen;
                        textOccluded = placed.occluded;
                    }

                    const isPlaced = placed && placed.box;
                    const prevOrientation = updatePreviousOrientationIfNotPlaced(!!isPlaced);

                    if (!placeText && placement.prevPlacement) {
                        const prevOffset = placement.prevPlacement.variableOffsets[crossTileID];
                        if (prevOffset) {
                            placement.variableOffsets[crossTileID] = prevOffset;
                            markUsedJustification(bucket, prevOffset.anchor, symbolInstance, prevOrientation);
                        }
                    }
                }
            }

            placedGlyphBoxes = placed;

            placeText = placedGlyphBoxes && placedGlyphBoxes.box && placedGlyphBoxes.box.length > 0;
            offscreen = placedGlyphBoxes && placedGlyphBoxes.offscreen;
            textOccluded = placedGlyphBoxes && placedGlyphBoxes.occluded;

            if (symbolInstance.useRuntimeCollisionCircles) {
                const placedSymbolIndex = symbolInstance.centerJustifiedTextSymbolIndex >= 0 ? symbolInstance.centerJustifiedTextSymbolIndex : symbolInstance.verticalPlacedTextSymbolIndex;
                const placedSymbol = bucket.text.placedSymbolArray.get(placedSymbolIndex);
                const fontSize = evaluateSizeForFeature(bucket.textSizeData, partiallyEvaluatedTextSize, placedSymbol);
                const textPixelPadding = layout.get('text-padding');
                const circlePixelDiameter = symbolInstance.collisionCircleDiameter * fontSize / ONE_EM;

                placedGlyphCircles = placement.collisionIndex.placeCollisionCircles(
                    bucket,
                    textAllowOverlap,
                    placedSymbol,
                    placedSymbolIndex,
                    bucket.lineVertexArray,
                    bucket.glyphOffsetArray,
                    fontSize,
                    posMatrix as Float32Array,
                    textLabelPlaneMatrix as Float32Array,
                    labelToScreenMatrix,
                    showCollisionBoxes,
                    pitchWithMap,
                    collisionGroup.predicate,
                    circlePixelDiameter,
                    textPixelPadding,
                    placement.retainedQueryData[bucket.bucketInstanceId].tileID
                );

                assert(!placedGlyphCircles.circles.length || (!placedGlyphCircles.collisionDetected || showCollisionBoxes));
                placeText = textAllowOverlap || (placedGlyphCircles.circles.length > 0 && !placedGlyphCircles.collisionDetected);
                offscreen = offscreen && placedGlyphCircles.offscreen;
                textOccluded = placedGlyphCircles.occluded;
            }

            if (collisionArrays.iconFeatureIndex) {
                iconFeatureIndex = collisionArrays.iconFeatureIndex;
            }

            if (collisionArrays.iconBox) {
                const placeIconFeature = (iconBox: SingleCollisionBox) => {
                    updateBoxData(iconBox);
                    const shiftPoint: Point = symbolInstance.hasIconTextFit && shift ?
                        offsetShift(shift.x, shift.y, textRotateWithMap, pitchWithMap, placement.transform.angle) :
                        new Point(0, 0);
                    const iconScale = bucket.getSymbolInstanceIconSize(partiallyEvaluatedIconSize, placement.transform.zoom, symbolInstance.placedIconSymbolIndex);
                    return placement.collisionIndex.placeCollisionBox(bucket, iconScale, iconBox, mercatorCenter, invMatrix, iconProjectedPosOnLabelSpace, shiftPoint,
                        iconAllowOverlap, textPixelRatio, posMatrix, collisionGroup.predicate);
                };

                if (placedVerticalText && placedVerticalText.box && placedVerticalText.box.length && collisionArrays.verticalIconBox) {
                    placedIconBoxes = placeIconFeature(collisionArrays.verticalIconBox);
                    placeIcon = placedIconBoxes.box.length > 0;
                } else {
                    placedIconBoxes = placeIconFeature(collisionArrays.iconBox);
                    placeIcon = placedIconBoxes.box.length > 0;
                }
                offscreen = offscreen && placedIconBoxes.offscreen;
                iconOccluded = placedIconBoxes.occluded;
            }

            const iconWithoutText = textOptional ||
                (symbolInstance.numHorizontalGlyphVertices === 0 && numVerticalGlyphVertices === 0);
            const textWithoutIcon = iconOptional || symbolInstance.numIconVertices === 0;

            if (!iconWithoutText && !textWithoutIcon) {
                placeIcon = placeText = placeIcon && placeText;
            } else if (!textWithoutIcon) {
                placeText = placeIcon && placeText;
            } else if (!iconWithoutText) {
                placeIcon = placeIcon && placeText;
            }

            if (placeText && placedGlyphBoxes && placedGlyphBoxes.box) {
                if (placedVerticalText && placedVerticalText.box && verticalTextFeatureIndex) {
                    placement.collisionIndex.insertCollisionBox(placedGlyphBoxes.box, layout.get('text-ignore-placement'),
                        bucket.bucketInstanceId, verticalTextFeatureIndex, collisionGroup.ID);
                } else {
                    placement.collisionIndex.insertCollisionBox(placedGlyphBoxes.box, layout.get('text-ignore-placement'),
                        bucket.bucketInstanceId, textFeatureIndex, collisionGroup.ID);
                }
            }

            if (placeIcon && placedIconBoxes) {
                placement.collisionIndex.insertCollisionBox(placedIconBoxes.box, layout.get('icon-ignore-placement'),
                    bucket.bucketInstanceId, iconFeatureIndex, collisionGroup.ID);
            }

            if (placedGlyphCircles) {
                if (placeText) {
                    placement.collisionIndex.insertCollisionCircles(placedGlyphCircles.circles, layout.get('text-ignore-placement'),
                        bucket.bucketInstanceId, textFeatureIndex, collisionGroup.ID);
                }

                if (showCollisionBoxes) {
                    const id = bucket.bucketInstanceId;
                    let circleArray = placement.collisionCircleArrays[id];
                    if (circleArray === undefined)
                        circleArray = placement.collisionCircleArrays[id] = new CollisionCircleArray();

                    for (let i = 0; i < placedGlyphCircles.circles.length; i += 4) {
                        circleArray.circles.push(placedGlyphCircles.circles[i + 0]);
                        circleArray.circles.push(placedGlyphCircles.circles[i + 1]);
                        circleArray.circles.push(placedGlyphCircles.circles[i + 2]);
                        circleArray.circles.push(placedGlyphCircles.collisionDetected ? 1 : 0);
                    }
                }
            }

            assert(crossTileID !== 0);
            assert(bucket.bucketInstanceId !== 0);

            const notGlobe = bucket.projection.name !== 'globe';
            alwaysShowText = alwaysShowText && (notGlobe || !textOccluded);
            alwaysShowIcon = alwaysShowIcon && (notGlobe || !iconOccluded);

            placement.placements[crossTileID] = new JointPlacement(placeText || alwaysShowText, placeIcon || alwaysShowIcon, offscreen || bucket.justReloaded);
            seenCrossTileIDs.add(crossTileID);
        };

        const tileID = placement.retainedQueryData[bucket.bucketInstanceId].tileID;

        if (bucket.elevationType === 'offset' && placement.buildingIndex) {
            placement.buildingIndex.updateZOffset(bucket, tileID);
        }

        if (bucket.elevationType === 'road' && bucket.hdExt) {
            bucket.hdExt.updateRoadElevation(bucket, tileID.canonical);
        }

        bucket.updateZOffset();

        if (bucket.sortFeaturesByY) {
            assert(bucketPart.symbolInstanceStart === 0);
            const symbolIndexes = bucket.getSortedSymbolIndexes(placement.transform.angle);
            for (let i = symbolIndexes.length - 1; i >= 0; --i) {
                const symbolIndex = symbolIndexes[i];
                placeSymbol(bucket.symbolInstances.get(symbolIndex), symbolIndex, bucket.collisionArrays[symbolIndex]);
            }
            if (bucket.hasAnyZOffset) warnOnce(`${bucket.layerIds[0]} layer symbol-z-elevate: symbols are not sorted by elevation if symbol-z-order is evaluated to viewport-y`);

        } else if (bucket.hasAnyZOffset) {
            const indexes = bucket.getSortedIndexesByZOffset();
            for (let i = 0; i < indexes.length; ++i) {
                const symbolIndex = indexes[i];
                placeSymbol(bucket.symbolInstances.get(symbolIndex), symbolIndex, bucket.collisionArrays[symbolIndex]);
            }
        } else {
            for (let i = bucketPart.symbolInstanceStart; i < bucketPart.symbolInstanceEnd; i++) {
                placeSymbol(bucket.symbolInstances.get(i), i, bucket.collisionArrays[i]);
            }
        }

        if (showCollisionBoxes && bucket.bucketInstanceId in placement.collisionCircleArrays) {
            const circleArray = placement.collisionCircleArrays[bucket.bucketInstanceId];
            mat4.invert(circleArray.invProjMatrix, posMatrix);
            circleArray.viewportMatrix = placement.collisionIndex.getViewportMatrix();
        }

        bucket.justReloaded = false;
    }

    attemptAnchorPlacement(
        placement: Placement,
        anchor: TextAnchor,
        textBox: SingleCollisionBox,
        mercatorCenter: [number, number],
        invMatrix: mat4,
        projectedPosOnLabelSpace: boolean,
        width: number,
        height: number,
        textScale: number,
        rotateWithMap: boolean,
        pitchWithMap: boolean,
        textPixelRatio: number,
        posMatrix: mat4,
        collisionGroup: CollisionGroup,
        textAllowOverlap: boolean,
        symbolInstance: SymbolInstance,
        boxIndex: number,
        bucket: SymbolBucket,
        orientation: Orientation,
        iconBox: SingleCollisionBox | null | undefined,
        textSize: InterpolatedSize,
        iconSize: InterpolatedSize,
    ): {shift: Point; placedGlyphBoxes: PlacedCollisionBox} | null | undefined {
        const {textOffset0, textOffset1, crossTileID} = symbolInstance;
        const textOffset: [number, number] = [textOffset0, textOffset1];
        const shift = calculateVariableLayoutShift(anchor, width, height, textOffset, textScale);

        const placedGlyphBoxes = placement.collisionIndex.placeCollisionBox(
            bucket, textScale, textBox, mercatorCenter, invMatrix, projectedPosOnLabelSpace,
            offsetShift(shift.x, shift.y, rotateWithMap, pitchWithMap, placement.transform.angle),
            textAllowOverlap, textPixelRatio, posMatrix, collisionGroup.predicate);

        if (iconBox) {
            const size = bucket.getSymbolInstanceIconSize(iconSize, placement.transform.zoom, symbolInstance.placedIconSymbolIndex);
            const placedIconBoxes = placement.collisionIndex.placeCollisionBox(
                bucket, size, iconBox, mercatorCenter, invMatrix, projectedPosOnLabelSpace,
                offsetShift(shift.x, shift.y, rotateWithMap, pitchWithMap, placement.transform.angle),
                textAllowOverlap, textPixelRatio, posMatrix, collisionGroup.predicate);
            if (placedIconBoxes.box.length === 0) return;
        }

        if (placedGlyphBoxes.box.length > 0) {
            let prevAnchor: TextAnchor;
            if (placement.prevPlacement &&
                placement.prevPlacement.variableOffsets[crossTileID] &&
                placement.prevPlacement.placements[crossTileID] &&
                placement.prevPlacement.placements[crossTileID].text) {
                prevAnchor = placement.prevPlacement.variableOffsets[crossTileID].anchor;
            }
            assert(crossTileID !== 0);
            placement.variableOffsets[crossTileID] = {
                textOffset,
                width,
                height,
                anchor,
                textScale,
                prevAnchor
            };
            markUsedJustification(bucket, anchor, symbolInstance, orientation);

            if (bucket.allowVerticalPlacement) {
                markUsedOrientation(bucket, orientation, symbolInstance);
                placement.placedOrientations[crossTileID] = orientation;
            }

            return {shift, placedGlyphBoxes};
        }
    }

}
