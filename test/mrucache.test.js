var expect = require('expect.js');

var MRUCache = require('../js/mrucache.js');

describe('mrucache', function() {
    describe('#construction', function() {
        it('can be initialized', function() {
            var cache = new MRUCache(10);
            expect(cache).to.be.ok();
            expect(cache.max).to.eql(10);
        });
    });

    describe('#add', function() {
        it('adds items', function() {
            var cache = new MRUCache(10);
            expect(cache).to.be.ok();
            expect(cache.add('foo', 'bar')).to.eql(cache);
            expect(cache.has('foo')).to.eql(true);
        });
    });

    describe('#keys', function() {
        it('lists keys', function() {
            var cache = new MRUCache(10);
            expect(cache).to.be.ok();
            expect(cache.add('foo', 'bar')).to.eql(cache);
            expect(cache.keys()).to.eql(['foo']);
        });
    });

    describe('#get', function() {
        it('gets an item', function() {
            var cache = new MRUCache(10);
            expect(cache).to.be.ok();
            expect(cache.add('foo', 'bar')).to.eql(cache);
            expect(cache.get('foo')).to.eql('bar');
        });
    });

    describe('#reset', function() {
        it('removes all items', function() {
            var cache = new MRUCache(10);
            expect(cache).to.be.ok();
            expect(cache.add('foo', 'bar')).to.eql(cache);
            expect(cache.has('foo')).to.eql(true);
            expect(cache.reset()).to.eql(cache);
            expect(cache.has('foo')).to.eql(false);
        });
    });
});
