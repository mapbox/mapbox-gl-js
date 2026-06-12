/** @typedef {import('eslint').Linter.Config} EslintConfig */

import path from 'node:path';
import {fileURLToPath} from 'node:url';
import e18e from '@e18e/eslint-plugin';
import jsdoc from 'eslint-plugin-jsdoc';
import config from 'eslint-config-mourner';
import tseslint from 'typescript-eslint';
import {createNodeResolver, importX} from 'eslint-plugin-import-x';
import {createTypeScriptImportResolver} from 'eslint-import-resolver-typescript';
import {globalIgnores} from 'eslint/config';
import {includeIgnoreFile} from '@eslint/compat';
import noObjectMethodsOnCollections from './test/eslint-rules/no-object-methods-on-collections.ts';
import devtoolsMustUseDebugRun from './test/eslint-rules/devtools-must-use-debug-run.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, '.gitignore');

const STRICT_JSDOC_FILES = [
    'src/index.ts',
    'src/ui/**',
    'src/source/**',
    'src/geo/lng_lat.ts',
    'src/geo/mercator_coordinate.ts',
];

const DEV_FILES = [
    'test/**',
    'build/**',
    'internal/**',
    'rollup.*',
    'vitest.config.*',
    'eslint.config.js',
    'src/style-spec/test.js',
    'src/style-spec/rollup.config.js',
    'plugins/mapbox-gl-pmtiles-provider/rollup.config.ts',
];

const UNTYPED_FILES = [
    './test/release/**/*',
    './test/integration/**/*.js',
    './test/build/style-spec.test.js',
    './build/start-server.js',
];

const IGNORED_PATHS = [
    './dist',
    './debug',
    './rollup',
    './src/style-spec/bin',
    './src/style-spec/dist',
    './src/style-spec/data',
    './src/style-spec/reference',
    './test/release/**/*',
    './test/integration/render-tests/**/*',
    './test/integration/query-tests/**/*',
    './test/integration/expression-tests/**/*',
    './test/integration/csp-tests/**/*',
    './test/integration/data/**/*',
    './test/integration/glyphs/**/*',
    './test/integration/image/**/*',
    './test/integration/models/**/*',
    './test/integration/sprites/**/*',
    './test/integration/styles/**/*',
    './test/integration/tiles/**/*',
    './test/integration/tilesets/**/*',
    './test/integration/lib/operation-handlers.js',
    './test/build/vite/**/*',
    './test/build/webpack/**/*',
    './test/build/typings/**/*',
    './test/build/style-spec.test.js',
    './dts.config.cjs',
];

export default tseslint.config(
    globalIgnores(IGNORED_PATHS),
    includeIgnoreFile(gitignorePath),

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    ...config,
    /** @type {EslintConfig} */ (e18e.configs.recommended),
    tseslint.configs.recommendedTypeChecked,
    importX.flatConfigs.recommended,

    {
        linterOptions: {
            reportUnusedDisableDirectives: 'error',
        },

        languageOptions: {
            parserOptions: {
                project: ['./tsconfig.strict.json', './tsconfig.browser.json', './tsconfig.node.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },

        plugins: {
            jsdoc,
            mapbox: {
                rules: {
                    'devtools-must-use-debug-run': devtoolsMustUseDebugRun,
                    'no-object-methods-on-collections': noObjectMethodsOnCollections,
                },
            },
        },

        settings: {
            'import-x/parsers': {
                '@typescript-eslint/parser': ['.ts'],
            },

            'import-x/resolver-next': [createTypeScriptImportResolver(), createNodeResolver()],

            jsdoc: {
                mode: 'typescript',
                ignorePrivate: true,
                preferredTypes: {
                    object: 'Object',
                },
                tagNamePreference: {
                    augments: 'extends',
                    method: 'method',
                    var: 'var',
                }
            },
        },
    },

    {
        rules: {
            // General
            'no-use-before-define': 'off',
            'arrow-body-style': 'off',
            'no-control-regex': 'off',
            'no-invalid-this': 'off',
            'no-prototype-builtins': 'off',
            'accessor-pairs': 'off',
            'require-atomic-updates': 'off',
            'consistent-return': 'off',
            'no-lonely-if': 'off',
            'no-new': 'off',
            'no-warning-comments': 'error',
            'dot-notation': 'off',
            'no-else-return': 'off',
            'no-lone-blocks': 'off',
            'no-mixed-operators': ['error', {
                groups: [['&', '|', '^', '~', '<<', '>>', '>>>'], ['&&', '||']],
            }],
            'object-curly-spacing': ['error', 'never'],
            'prefer-const': ['error', {
                destructuring: 'all',
            }],
            'template-curly-spacing': 'error',
            'no-useless-escape': 'off',
            'no-useless-assignment': 'off',
            'no-multiple-empty-lines': ['error', {max: 1}],
            'no-restricted-syntax': ['error',
                {
                    selector: 'ClassProperty[value]',
                    message: 'ClassProperty values are not allowed.',
                }, {
                    selector: 'LogicalExpression[operator=\'??\']',
                    message: 'Nullish coalescing is not allowed.',
                }, {
                    selector: 'ChainExpression',
                    message: 'Optional chaining is not allowed.',
                }, {
                    selector: 'MemberExpression[object.type=\'MetaProperty\'][property.name=\'url\']',
                    message: 'import.meta.url is not available in the UMD bundle.',
                }, {
                    selector: 'MemberExpression[object.name=\'process\'][property.name=\'env\']',
                    message: 'process.env is not available in browser bundles. Use import.meta.env instead.',
                }, {
                    selector: 'MemberExpression[property.name=\'importScripts\']',
                    message: 'importScripts is not allowed. Use dynamic import() instead.',
                }, {
                    selector: 'MemberExpression[property.type=\'Literal\'][property.value=\'importScripts\']',
                    message: 'importScripts is not allowed. Use dynamic import() instead.',
                }
            ],
            'no-void': 'error',
            'no-restricted-globals': ['error', {
                name: 'importScripts',
                message: 'importScripts is not allowed. Use dynamic import() instead.',
            }],
            'prefer-object-has-own': 'error',
            'prefer-object-spread': 'error',

            // TypeScript
            '@typescript-eslint/unbound-method': 'off',
            '@typescript-eslint/only-throw-error': 'off',
            '@typescript-eslint/method-signature-style': 'error',
            '@typescript-eslint/consistent-type-exports': 'error',
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/no-redundant-type-constituents': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error', {
                args: 'none',
                caughtErrors: 'none',
                ignoreRestSiblings: true,
            }],
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/no-floating-promises': ['error', {ignoreVoid: false}],
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/ban-ts-comment': ['error', {'ts-expect-error': true}],

            // Imports
            'import-x/no-commonjs': 'error',
            'import-x/named': 'off',
            'import-x/namespace': 'off',
            'import-x/default': 'off',
            'import-x/no-named-as-default-member': 'off',
            'import-x/no-unresolved': 'off',
            'import-x/no-named-as-default': 'off',
            'no-duplicate-imports': 'off',
            'import-x/no-duplicates': 'error',
            'import-x/order': ['error', {
                groups: [[
                    'builtin',
                    'external',
                    'internal',
                    'unknown',
                    'parent',
                    'sibling',
                    'index',
                    'object',
                ], 'type'],
                'newlines-between': 'always',
            }],
            'import-x/no-restricted-paths': ['error', {
                zones: [{
                    target: './src/style-spec',
                    from: ['./src/!(style-spec)/**/*', './3d-style/**/*', './modules/**/*', './plugins/**/*'],
                }],
            }],
            'import-x/extensions': ['error', {
                ts: 'ignorePackages',
                js: 'always',
                json: 'always',
            }],

            // e18e (disabled for browser compatibility)
            'e18e/prefer-spread-syntax': 'off',       // also rewrites .concat/Array.from (array-spread regressions); object spread enforced via core prefer-object-spread
            'e18e/prefer-nullish-coalescing': 'off',  // ?? not allowed (affects some downstream bundlers)
            'e18e/prefer-array-to-sorted': 'off',     // Not available until Safari 16
            'e18e/prefer-array-to-reversed': 'off',   // Not available until Safari 16
            'e18e/prefer-url-canparse': 'off',        // Not available until Safari 17

            // Stylistic
            '@stylistic/no-confusing-arrow': ['error', {onlyOneSimpleParam: true}],
            '@stylistic/arrow-parens': 'off',
            '@stylistic/indent': ['error', 4, {
                flatTernaryExpressions: true,
                SwitchCase: 0,
                CallExpression: {arguments: 'off'},
                FunctionDeclaration: {parameters: 'off'},
            }],
            '@stylistic/quotes': 'off',
            '@stylistic/operator-linebreak': ['error', 'after', {
                overrides: {
                    '|': 'before' // allow `|` before line breaks for union types
                }
            }],

            // JSDoc
            'jsdoc/check-tag-names': ['error', {
                'definedTags': ['section', 'experimental', 'note'],
            }],

            // Custom rules
            'mapbox/devtools-must-use-debug-run': 'error',
            'mapbox/no-object-methods-on-collections': 'error',
        }
    },

    {
        files: STRICT_JSDOC_FILES,
        rules: {
            'jsdoc/check-access': 'error',
            'jsdoc/check-alignment': 'error',
            'jsdoc/check-line-alignment': ['error'],
            'jsdoc/check-param-names': 'error',
            'jsdoc/check-property-names': 'error',
            'jsdoc/check-types': 'error',
            'jsdoc/multiline-blocks': 'error',
            'jsdoc/no-multi-asterisks': ['error', {allowWhitespace: true}],
            'jsdoc/require-description-complete-sentence': 'error',
            'jsdoc/require-description': 'error',
            'jsdoc/require-example': 'error',
            'jsdoc/require-jsdoc': ['error', {publicOnly: true}],
            'jsdoc/require-param-description': 'error',
            'jsdoc/require-param-name': 'error',
            'jsdoc/require-param-type': 'error',
            'jsdoc/require-param': 'error',
            'jsdoc/require-property-description': 'error',
            'jsdoc/require-property-name': 'error',
            'jsdoc/require-property-type': 'error',
            'jsdoc/require-property': 'error',
            'jsdoc/require-returns-check': 'error',
            'jsdoc/require-returns-description': 'error',
            'jsdoc/require-returns-type': 'error',
            'jsdoc/require-returns': 'error',
            'jsdoc/tag-lines': ['error', 'any', {startLines: 1}],
        },
    },

    {
        files: DEV_FILES,
        rules: {
            'no-restricted-syntax': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-implied-eval': 'off',
            '@typescript-eslint/ban-ts-comment': ['error', {'ts-expect-error': 'allow-with-description'}],
            'e18e/prefer-static-regex': 'off',
            'mapbox/devtools-must-use-debug-run': 'off',
        },
    },

    {
        files: UNTYPED_FILES,
        extends: [tseslint.configs.disableTypeChecked],
        rules: {
            'mapbox/no-object-methods-on-collections': 'off',
        },
    },
);
