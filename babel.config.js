module.exports = {
  plugins: [
    '@babel/plugin-proposal-class-properties', // 解析类的属性插件 class Test { static prop = 'test' }
    [
      '@babel/plugin-transform-runtime',
      { corejs: 3 }, // 支持所有@babel/runtime的helpers函数，和@babel/polyfill注入方法
    ],
  ],
  presets: [
    [
      '@babel/preset-env',
      {
        useBuiltIns: 'usage', // usage-按需引入 entry-入口引入（整体引入） false-不引入polyfill（污染全局）
        // corejs: 3,  // 避免和 transform-runtime 冲突
        targets: { node: '8.0.0' }, // default: > 0.5%, last 2 versions, Firefo
      },
    ],
    '@babel/preset-typescript',
  ],
};
