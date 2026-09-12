import commonjs from '@rollup/plugin-commonjs';

export default [
  {
    input: './index.js',
    plugins: [commonjs()],
    output: [
      {
        file: './index.cjs',
        exports: 'named',
        format: 'cjs',
      },
    ],
  },
];
