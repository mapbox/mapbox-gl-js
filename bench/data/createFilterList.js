const fs = require('fs');
const style = require('./style.json');

const filters = style.layers.filter(l => l.filter && l['source-layer']).map(l => {
    return {layer: l['source-layer'], filter: l.filter}
});

fs.writeFileSync('expression_filters.json', JSON.stringify(filters));
