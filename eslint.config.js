import path from 'node:path';
import {fileURLToPath} from 'node:url';
import jsdoc from 'eslint-plugin-jsdoc';
import config from 'eslint-config-mourner';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import {globalIgnores} from 'eslint/config';
import {includeIgnoreFile} from '@eslint/compat';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, '.gitignore');

export default tseslint.config(
    globalIgnores([
        './debug/**/*',
        './rollup/**/*',
        './src/style-spec/bin',
        './src/style-spec/dist',
        './test/build/typings/**/*',
        './test/build/transpilation/**/*',
    ]),

    includeIgnoreFile(gitignorePath),

    ...config,
    tseslint.configs.recommendedTypeChecked,
    importPlugin.flatConfigs.recommended,
    jsdoc.configs['flat/recommended'],

    // Settings
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },

        settings: {
            'import/parsers': {
                '@typescript-eslint/parser': ['.ts'],
            },

            'import/resolver': {
                node: true,
                typescript: {
                    project: './tsconfig.json',
                },
            },

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
        }
    },

    // Default rules
    {
        rules: {
            'no-loss-of-precision': 'off',
            'no-use-before-define': 'off',
            'implicit-arrow-linebreak': 'off',
            'arrow-parens': 'off',
            'arrow-body-style': 'off',
            'no-confusing-arrow': 'off',
            'no-control-regex': 'off',
            'no-invalid-this': 'off',
            'no-prototype-builtins': 'off',
            'accessor-pairs': 'off',
            'require-atomic-updates': 'off',
            'array-bracket-spacing': 'off',
            'consistent-return': 'off',
            'global-require': 'off',
            'import/no-commonjs': 'error',
            'key-spacing': 'off',
            'no-eq-null': 'off',
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
            'prefer-arrow-callback': 'error',

            'prefer-const': ['error', {
                destructuring: 'all',
            }],

            'prefer-template': 'error',
            'quotes': 'off',
            'space-before-function-paren': 'off',
            'template-curly-spacing': 'error',
            'no-useless-escape': 'off',

            'indent': ['error', 4, {
                flatTernaryExpressions: true,
                CallExpression: {arguments: 'off'},
                FunctionDeclaration: {parameters: 'off'},
                FunctionExpression: {parameters: 'off'},
            }],

            'no-multiple-empty-lines': ['error', {max: 1}],

            'no-restricted-syntax': ['error',
                {
                    selector: 'ObjectExpression > SpreadElement',
                    message: 'Spread syntax is not allowed for object assignments. Use Object.assign() or other methods instead.',
                }, {
                    selector: 'AwaitExpression',
                    message: 'Async/await syntax is not allowed.',
                }, {
                    selector: 'FunctionDeclaration[async=true]',
                    message: 'Async function declarations are not allowed.',
                }, {
                    selector: 'FunctionExpression[async=true]',
                    message: 'Async function expressions are not allowed.',
                }, {
                    selector: 'ArrowFunctionExpression[async=true]',
                    message: 'Async arrow functions are not allowed.',
                }, {
                    selector: 'ClassProperty[value]',
                    message: 'ClassProperty values are not allowed.',
                }, {
                    selector: 'LogicalExpression[operator=\'??\']',
                    message: 'Nullish coalescing is not allowed.',
                }, {
                    selector: 'ChainExpression',
                    message: 'Optional chaining is now allowed.',
                }
            ],
        }
    },

    // TypeScript specific rules
    {
        rules: {
            '@typescript-eslint/unbound-method': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-loss-of-precision': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/only-throw-error': 'off',
            '@typescript-eslint/method-signature-style': 'error',
            '@typescript-eslint/consistent-type-exports': 'error',
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/restrict-template-expressions': ['off', {
                allowNever: true,
            }],
            '@typescript-eslint/no-unnecessary-type-constraint': 'off',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error', {
                args: 'none',
                caughtErrors: 'none',
                ignoreRestSiblings: true,
            }],
        }
    },

    // Import plugin rules
    {
        rules: {
            'import/named': 'off',
            'import/namespace': 'off',
            'import/default': 'off',
            'import/no-named-as-default-member': 'off',
            'import/no-unresolved': 'off',
            'import/no-named-as-default': 'off',
            'no-duplicate-imports': 'off',
            'import/no-duplicates': 'error',

            'import/order': ['error', {
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

            'import/no-restricted-paths': ['error', {
                zones: [{
                    target: './src/style-spec',
                    from: ['./src/!(style-spec)/**/*', './3d-style/**/*'],
                }],
            }],

            'import/extensions': ['error', {
                js: 'always',
                json: 'always',
            }],
        },
    },

    // Stylistic rules
    {
        rules: {
            '@stylistic/no-confusing-arrow': ['error', {onlyOneSimpleParam: true}],

            '@stylistic/arrow-parens': 'off',
            '@stylistic/indent': 'off',
            '@stylistic/quotes': 'off',

            // Override operator-linebreak to allow | before line breaks for union types
            '@stylistic/operator-linebreak': ['error', 'after', {
                overrides: {
                    '|': 'before'
                }
            }],
        }
    },

    // JSDoc specific rules
    {
        rules: {
            'jsdoc/check-tag-names': ['warn', {
                'definedTags': ['section', 'experimental', 'note'],
            }],

            // Disable JSDoc rules that are not relevant to public APIs.
            'jsdoc/check-alignment': 'off',
            'jsdoc/check-line-alignment': 'off',
            'jsdoc/check-param-names': 'off',
            'jsdoc/multiline-blocks': 'off',
            'jsdoc/no-defaults': 'off',
            'jsdoc/no-multi-asterisks': 'off',
            'jsdoc/no-types': 'off',
            'jsdoc/require-description-complete-sentence': 'off',
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param-description': 'off',
            'jsdoc/require-param-type': 'off',
            'jsdoc/require-param': 'off',
            'jsdoc/require-returns-check': 'off',
            'jsdoc/require-returns-description': 'off',
            'jsdoc/require-returns-type': 'off',
            'jsdoc/require-returns': 'off',
            'jsdoc/tag-lines': 'off',
        }
    },

    // JSDoc specific rules for public APIs
    {
        files: [
            'src/index.ts',
            'src/ui/**',
            'src/source/**',
            'src/geo/lng_lat.ts',
            'src/geo/mercator_coordinate.ts',
        ],

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

    // Disable `no-restricted-syntax` for test/, build/, and config files
    {
        files: [
            'test/**',
            'build/**',
            'rollup.*'
        ],

        rules: {
            'no-restricted-syntax': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
        }
    },

    // Disable type-aware linting for files that are not migrated to TypeScript
    {
        files: [
            './test/release/**/*',
            './test/integration/**/*',
            './test/build/style-spec.test.js',
            './test/build/browserify-test-fixture.js'
        ],

        extends: [tseslint.configs.disableTypeChecked],
    },
);
