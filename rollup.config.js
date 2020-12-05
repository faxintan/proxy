import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import babel from '@rollup/plugin-babel';
import { terser } from "rollup-plugin-terser";
import pkg from './package.json';

const extensions = [
  '.js', '.jsx', '.ts', '.tsx',
];

export default {
  input: './src/index.ts',

  // Specify here external modules which you don't want to include in your bundle (for instance: 'lodash', 'moment' etc.)
  external: ['mkcert', 'regedit'],

  plugins: [
    // Allows node_modules resolution (include package code)
    resolve({ extensions }),

    // Allow bundling cjs modules. Rollup doesn't understand cjs (before all plugins.)
    commonjs(),

    json(),

    // Compile TypeScript/JavaScript files (according to babel.config.js)
    babel({
      extensions,
      babelHelpers: 'runtime', // enabled Runtime helpers, support the transform-runtime plugin
      include: ['src/**/*'],
      exclude: ['node_modules'],
    }),

    // minify generated bundle
    terser(),
  ],

  output: [
    {
      file: pkg.main,
      format: 'cjs',
      // sourcemap: true,
    },
    {
      file: pkg.module,
      format: 'es',
    },
    // {
    //   file: pkg.browser,
    //   format: 'iife',
    //   name: 'test',
    //   // https://rollupjs.org/guide/en#output-globals-g-globals
    //   globals: {},
    // }
  ],
};