module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  env: {
    es2022: true,
    jest: true,
    node: true,
  },
  ignorePatterns: ["dist/", "node_modules/"],
  rules: {},
};
