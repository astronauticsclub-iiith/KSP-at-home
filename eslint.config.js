import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
    {
        languageOptions: {
            globals: {
                ...globals.browser
            }
        },
        plugins: { prettier },
        rules: {
            ...prettierConfig.rules,
            'prettier/prettier': 'error',
            'no-unused-vars': 'warn',
            'no-undef': 'error',
        }
    }
];