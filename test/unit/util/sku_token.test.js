import {describe, test, expect} from "../../util/vitest.js";
import {createSkuToken, SKU_ID} from '../../../src/util/sku_token.js';

describe('sku token generation', () => {
    const skuToken = createSkuToken().token;

    test('token is the correct length', () => {
        expect(skuToken.length).toEqual(13);
    });

    test('token has the correct token version', () => {
        expect(skuToken.charAt(0)).toEqual('1');
    });

    test('token has the correct sku ID', () => {
        expect(skuToken.slice(1, 3)).toEqual(SKU_ID);
    });

    test('createSkuToken generates a unique token each time it\'s called', () => {
        const secondSkuToken = createSkuToken().token;
        const thirdSkuToken = createSkuToken().token;
        expect(skuToken).not.toEqual(secondSkuToken);
        expect(skuToken).not.toEqual(thirdSkuToken);
        expect(secondSkuToken).not.toEqual(thirdSkuToken);
    });
});
