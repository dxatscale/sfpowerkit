module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
      '@typescript-eslint',
    ],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "prefer-const":"off",
        "@typescript-eslint/no-var-requires":"off"
      },
      env: {
        node: true,  
      },  
  };

  