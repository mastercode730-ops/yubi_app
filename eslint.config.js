// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // Screens load data in mount/focus effects and flip a loading state
      // first — the standard fetch-on-mount pattern. Keep it visible as a
      // warning rather than blocking lint.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
