const path = require('path');
const srcDir = '../src/';

const MODE = "production";

module.exports = {
    mode: MODE,
    entry: {
        popup: path.join(__dirname, srcDir + 'popup.ts'),
        background: path.join(__dirname, srcDir + 'background.ts'),
        content_script: path.join(__dirname, srcDir + 'content_script.ts')
    },
    optimization:{
        minimize: MODE === "production",
    },
    output: {
        path: path.join(__dirname, '../dist/'),
        filename: '[name].js'
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js']
    }
};