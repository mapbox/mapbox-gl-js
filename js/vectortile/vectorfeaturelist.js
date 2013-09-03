function VectorFeatureList(features) {
    this.list = _(features || []);
}

VectorFeatureList.prototype = {
    get length() {
        return this.list.size();
    },

    add: function(feature) {
        this.list.push(feature);
    },

    filter: function(fn) {
        return new VectorFeatureList(this.list.filter(fn));
    },

    where: function(props) {
        return new VectorFeatureList(this.list.wh(props));
    },

    each: function(fn) {
        this.list.each(fn);
    }
};

VectorFeatureList.empty = new VectorFeatureList([]);
