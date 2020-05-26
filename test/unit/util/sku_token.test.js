import {test} from '../../util/test';
import {createSkuToken, SKU_ID} from '../../../src/util/sku_token';

test('sku token generation', (t) => {
    const skuToken = createSkuToken().token;

    t.test('token is the correct length', (t) => {
        t.equal(skuToken.length, 13);
        t.end();
    });

    t.test('token has the correct token version', (t) => {
        t.equal(skuToken.charAt(0), '1');
        t.end();
    });

    t.test('token has the correct sku ID', (t) => {
        t.equal(skuToken.slice(1, 3), SKU_ID);
        t.end();
    });

    t.test('createSkuToken generates a unique token each time it\'s called', (t) => {
        const secondSkuToken = createSkuToken().token;
        const thirdSkuToken = createSkuToken().token;
        t.notEqual(skuToken, secondSkuToken);
        t.notEqual(skuToken, thirdSkuToken);
        t.notEqual(secondSkuToken, thirdSkuToken);
        t.end();
    });

    t.end();
});
