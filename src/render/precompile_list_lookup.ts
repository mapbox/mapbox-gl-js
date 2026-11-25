// The style URL a list applies to: what the map was given, without its query.
export function styleUrl(style: string): string {
    return style.split('?')[0]!;
}

// The first zoom group a zoom falls in: min === max means exactly that zoom, otherwise min <= zoom < max.
export function zoomGroup(groups: ReadonlyArray<{name: string; min: number; max: number}>, zoom: number): string | undefined {
    const group = groups.find(g => (g.min === g.max ? zoom === g.min : zoom >= g.min && zoom < g.max));
    return group && group.name;
}
