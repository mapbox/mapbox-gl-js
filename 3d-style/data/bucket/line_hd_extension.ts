import assert from '../../../src/style-spec/util/assert';
import Point from '@mapbox/point-geometry';
import {register} from '../../../src/util/web_worker_transfer';
import {ELEVATION_CLIP_MARGIN, MARKUP_ELEVATION_BIAS} from '../../elevation/elevation_constants';
import {ElevationFeatureSampler, EdgeIterator, elevationIdDebugColor, type ElevationFeature, type Range} from '../../elevation/elevation_feature';
import {getElevationFeature} from '../../elevation/get_elevation_feature';
import {tileToMeter} from '../../../src/geo/mercator_coordinate';
import {clipLines, lineSubdivision, type LineInfo} from '../../../src/util/line_clipping';
import EXTENT from '../../../src/style-spec/data/extent';
import {FrcSegmentData, buildFrcLevelSegments} from '../frc_segment_builder';
import {featureFrcLevel, matchesCoverageSourceLayer} from '../frc_road_classes';

import type {CanonicalTileID} from '../../../src/source/tile_id';
import type {BucketFeature} from '../../../src/data/bucket';
import type LineBucket from '../../../src/data/bucket/line_bucket';
import type {Subsegment} from '../../../src/data/bucket/line_bucket';

function computeSegNextDir(info: LineInfo, line: Point[]) {
    assert(line.length > 1);
    return info.nextPoint.sub(line.at(-2)).unit();
}

function computeSegPrevDir(info: LineInfo, line: Point[]) {
    assert(line.length > 1);
    return line[1].sub(info.prevPoint).unit();
}

/**
 * HD extension for LineBucket. Owns the `heightRange` tracking and the road-feature
 * routing path.
 *
 * Much thinner than the fill counterpart: LineBucket's elevated vertex arrays
 * (`zOffsetVertexArray`, `elevationIdColVertexArray`, `elevationGroundScaleVertexArray`)
 * are dual-use — the 'offset' mode (Standard z-offset, sea/ground references) writes to
 * the same arrays. They stay on LineBucket. Only the `'road'` code path moves here.
 *
 * @private
 */
export class LineHDExtension {
    elevationEnabled: boolean;
    heightRange: Range | undefined;
    frcData: FrcSegmentData | undefined;

    constructor(elevationEnabled: boolean, frcEnabled: boolean) {
        this.elevationEnabled = elevationEnabled;
        if (frcEnabled) {
            this.frcData = new FrcSegmentData();
        }
    }

    isEmpty(): boolean {
        const elevEmpty = !this.elevationEnabled || this.heightRange === undefined;
        const frcEmpty = !this.frcData || this.frcData.empty();
        return elevEmpty && frcEmpty;
    }

    /// Compute the feature's FRC level and record it in the coverage set. Returns the
    /// level (or null) so the caller can pass it back to `recordFeatureRange`.
    trackFeatureFrc(properties: Record<string, unknown> | null | undefined): number | null {
        if (!this.frcData) return null;
        const frc = featureFrcLevel(properties || {});
        if (frc !== null) this.frcData.frcCoverage.add(frc);
        return frc;
    }

    /// Record a feature's [triStart, triEnd) triangle range. Called after addLine.
    recordFeatureRange(bucket: LineBucket, triStartIndex: number, triEndIndex: number, frc: number | null): void {
        if (!this.frcData || triEndIndex <= triStartIndex) return;
        const segArray = bucket.segments.get();
        this.frcData.featureTriSegments.push({
            start: triStartIndex * 3,
            end: triEndIndex * 3,
            segIdx: segArray.length > 0 ? segArray.length - 1 : 0,
            frc,
        });
    }

    /// Sort triangles by FRC and emit per-level segment vectors. Called once at the
    /// end of populate / addFeatures.
    buildFrcSegments(bucket: LineBucket): void {
        if (!this.frcData || this.frcData.empty()) return;
        buildFrcLevelSegments(this.frcData, bucket.indexArray, bucket.segments);
    }

    /**
     * Per-feature dispatch for HD road elevation. When tiled elevation covers the
     * feature, writes vertices through `bucket.addLine` (the shared line-geometry
     * pipeline) and populates `bucket.zOffsetVertexArray` / `elevationIdColVertexArray`
     * with sampled heights / debug colors. Otherwise the feature is still part of an
     * elevated bucket — clip it to the tile, route the segments through `addLine` with
     * subsegment metadata, and let the bucket fill the elevated arrays with zeros via
     * `fillNonElevatedRoadSegment`.
     */
    handleFeature(
        feature: BucketFeature,
        geometry: Array<Array<Point>>,
        canonical: CanonicalTileID,
        elevationFeatures: ElevationFeature[] | undefined,
        join: string,
        cap: string,
        miterLimit: number,
        roundLimit: number,
        bucket: LineBucket,
    ): boolean {
        if (!this.elevationEnabled) return false;
        const tiledElevation = getElevationFeature(feature, elevationFeatures);
        if (tiledElevation) {
            const clippedLines = clipLines(geometry, -ELEVATION_CLIP_MARGIN, -ELEVATION_CLIP_MARGIN, EXTENT + ELEVATION_CLIP_MARGIN, EXTENT + ELEVATION_CLIP_MARGIN);
            const preparedLines = this.prepareElevatedLines(clippedLines, tiledElevation, canonical);

            // Construct renderable geometries
            for (const line of preparedLines) {
                const vertexOffset = bucket.layoutVertexArray.length;
                bucket.addLine(line, feature, canonical, join, cap, miterLimit, roundLimit);

                // Populate height information for each vertex
                const sampler = new ElevationFeatureSampler(canonical, canonical);
                const col = bucket.showElevationIdDebug ? elevationIdDebugColor(tiledElevation.id) : null;
                for (let i = vertexOffset; i < bucket.layoutVertexArray.length; i++) {
                    const point = new Point(bucket.layoutVertexArray.int16[i * 6] >> 1, bucket.layoutVertexArray.int16[i * 6 + 1] >> 1);

                    const height = sampler.pointElevation(point, tiledElevation, MARKUP_ELEVATION_BIAS);
                    this.updateHeightRange(height);

                    bucket.zOffsetVertexArray.emplaceBack(height, 0.0, 0.0, 0.0);
                    if (col) {
                        bucket.elevationIdColVertexArray.emplaceBack(col[0], col[1], col[2]);
                    } else if (bucket.showElevationIdDebug) {
                        bucket.elevationIdColVertexArray.emplaceBack(0.0, 0.0, 0.0);
                    }
                }

                assert(bucket.layoutVertexArray.length === bucket.zOffsetVertexArray.length);
            }
            return true;
        }

        // Feature is not elevated but is rendered as part of (road) elevated bucket.
        // Due to clipping we're actually passing (possibly) a slightly smaller subsegment
        // of the original line.
        const hasMapboxLineMetrics = !!feature.properties && Object.hasOwn(feature.properties, 'mapbox_line_metrics') ? feature.properties['mapbox_line_metrics'] : false;
        const vertexOffset = bucket.layoutVertexArray.length;
        const linesInfo: LineInfo[] = [];
        const clippedLines = clipLines(geometry, -ELEVATION_CLIP_MARGIN, -ELEVATION_CLIP_MARGIN, EXTENT + ELEVATION_CLIP_MARGIN, EXTENT + ELEVATION_CLIP_MARGIN, linesInfo);
        for (let i = 0; i < clippedLines.length; i++) {
            const line = clippedLines[i];
            const info = linesInfo[i];

            const subseg: Subsegment = {
                progress: {min: info.progress.min, max: info.progress.max},
                nextDir: computeSegNextDir(info, line),
                prevDir: computeSegPrevDir(info, line)
            };

            const multiLineMetricsIndex = hasMapboxLineMetrics && info.parentIndex > 0 ? info.parentIndex : null;
            bucket.addLine(line, feature, canonical, join, cap, miterLimit, roundLimit, subseg, multiLineMetricsIndex);
        }

        bucket.fillNonElevatedRoadSegment(vertexOffset);
        return true;
    }

    private prepareElevatedLines(lines: Point[][], elevation: ElevationFeature, tileID: CanonicalTileID): Point[][] {
        if (elevation.constantHeight != null) {
            return lines;
        }

        // Subdivide the lines along the assigned elevation curve
        const splitLines: Point[][] = [];

        const metersToTile = 1.0 / tileToMeter(tileID);

        for (const line of lines) {
            lineSubdivision(line, new EdgeIterator(elevation, metersToTile), false, splitLines);
        }

        return splitLines;
    }

    private updateHeightRange(height: number): void {
        if (this.heightRange) {
            this.heightRange.min = Math.min(this.heightRange.min, height);
            this.heightRange.max = Math.max(this.heightRange.max, height);
        } else {
            this.heightRange = {min: height, max: height};
        }
    }
}

/**
 * Attach a `LineHDExtension` when either HD road elevation or FRC coverage tracking
 * applies. Elevation is gated on `line-elevation-reference === 'hd-road-markup'`;
 * FRC is gated on the bucket's source layer being in the configured
 * `coverageSourceLayers` set. The extension owns both feature sets internally so
 * core LineBucket carries no FRC fields.
 *
 * Called by `worker_tile.ts` immediately after LineBucket construction (BEFORE
 * `populate()` runs).
 *
 * @private
 */
export function maybeAttachLineHDExt(bucket: LineBucket, coverageSourceLayers: string[] | null | undefined): void {
    const elevationReference = bucket.layers[0].layout.get('line-elevation-reference');
    const elevationEnabled = elevationReference === 'hd-road-markup';
    const frcEnabled = !!coverageSourceLayers && coverageSourceLayers.length > 0 &&
        matchesCoverageSourceLayer(coverageSourceLayers, bucket.layers[0].source, bucket.sourceLayerName);
    if (!elevationEnabled && !frcEnabled) return;
    bucket.hdExt = new LineHDExtension(elevationEnabled, frcEnabled);
}

register(LineHDExtension, 'LineHDExtension');
