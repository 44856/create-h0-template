// esbuild.js
const esbuild = require('esbuild');
const path = require('path');
// 输出js的地址
/**
 * 自定义插件
 * @type { import('esbuild').Plugin }
 */

// 打包主方法
esbuild
    .build({
        entryPoints: [path.resolve( 'index.ts')],
        outdir: path.resolve('lib'),
        bundle: true,
        platform:'node',
        target: ['esnext']
    })
    .then((msg) => {
        if (msg.length) throw new Error('compile error');
        console.log('compile success');
    });