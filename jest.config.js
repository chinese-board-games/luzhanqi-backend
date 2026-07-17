/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  // @swc/jest just strips types (no type-checking) - fast, and unlike
  // ts-jest has no coupling to a specific TypeScript version. Real type
  // checking still happens via `tsc --noEmit`/`tsc-files` (pre-commit hook,
  // `npm run build`), so nothing is lost by not type-checking again here.
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
          },
          target: 'es2016',
        },
      },
    ],
  },
};
