#!/usr/bin/env node

'use strict';

// The `bin/xcodegen` binary must be called from here instead of `node_modules/.bin` folder,
// to give it access to `share` directory containing some presets.

const child_process = require('child_process');

child_process.spawnSync('./bin/xcodegen', process.argv.slice(2), {
  cwd: __dirname,
  stdio: 'inherit',
  env: process.env,
});
