import type Style from './style';

/**
 * A single entry in the Style BOM (Bill of Materials).
 * Either contains a style URL or a tileset URL, along with an optional modified timestamp.
 * @private
 */
export type StyleBOMEntry = {
    style?: string;
    modified?: string | number;
    tileset?: string;
};

/**
 * The Bill of Materials for a style, containing all styles and tilesets used.
 * @private
 */
export type StyleBOM = Array<StyleBOMEntry>;

/**
 * Utility namespace for Style BOM operations.
 * Calls to StyleBOMUtils.* are stripped from production builds.
 * @private
 */
export const StyleBOMUtils = {
    /**
     * Returns the Bill of Materials (BOM) for a style.
     * @private
     */
    getBOMObject(style: Style): StyleBOM {
        const bom: StyleBOM = [];
        const visited = new Set<string>();
        const rootStyleGlobalId = style.globalId;

        const processStyle = (s: Style) => {
            const globalId = s.globalId ? s.globalId : rootStyleGlobalId;
            const modified = s.stylesheet ? (s.stylesheet as {modified?: string}).modified : undefined;
            if (globalId && modified && !visited.has(globalId)) {
                visited.add(globalId);
                bom.push({
                    style: globalId,
                    modified: modified ? modified : null
                });
            }

            for (const fragment of s.fragments) {
                processStyle(fragment.style);
            }

            if (s.stylesheet && s.stylesheet.sources) {
                for (const sourceId in s.stylesheet.sources) {
                    const source = s.stylesheet.sources[sourceId];
                    if (source && 'url' in source && source.url) {
                        const data = (source as unknown as {data?: {modified?: number, created: number}}).data;
                        bom.push({
                            tileset: source.url,
                            modified: data ? data.modified || data.created : null
                        });
                    }
                }
            }
        };

        processStyle(style);
        return bom;
    }
};
