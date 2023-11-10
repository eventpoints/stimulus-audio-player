const path = require('path');

module.exports = {
    entry: './src/audio-player.js',
    output: {
        filename: 'stimulus-audio-player.mjs',
        path: path.resolve(__dirname, 'dist'),
        library: {
            type: 'module',
        },
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader', 'postcss-loader'],
            },
        ],
    },
    experiments: {
        outputModule: true,
    },
};