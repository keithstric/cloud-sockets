'use strict';

const express = require('express');
const http = require('http');
const cloudSockets = require('../../index');

const app = express();
global.server = http.createServer(app);

app.use(cloudSockets());

server.listen(3000, () => {
	console.log('express listening on port 3000');
});
