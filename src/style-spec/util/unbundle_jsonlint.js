
// Turn jsonlint-lines-primitives objects into primitive objects
function unbundle(value) {
    if (value instanceof Number || value instanceof String || value instanceof Boolean) {
        return value.valueOf();
    } else {
        return value;
    }
}

function deepUnbundle(value) {
    if (Array.isArray(value)) {
        return value.map(deepUnbundle);
    }
    return unbundle(value);
}

module.exports = unbundle;
module.exports.deep = deepUnbundle;
