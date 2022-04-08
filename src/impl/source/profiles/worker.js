const path = require('path');
const { workerData } = require('worker_threads');

if (workerData.path.endsWith('.ts')) require('ts-node').register();

require(path.resolve(__dirname, workerData.path));
