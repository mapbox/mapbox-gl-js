'use strict';

module.exports = function formatNumber(x) {
    return Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
