'use strict';
const express = require('express');
const http = require('http');
// Define your basic express setup
const app = express();
global.server = http.createServer(app);
// Define your middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Setup your acknowledgement message types
const socketOptions = {
	ackMessageTypes: ['announce']
}

// Define the cloud-sockets middleware after all your other middleware
const cloudSockets = require('../../index');
app.use(cloudSockets.socketServer(null, socketOptions));
// Startup the express server
server.listen(3000, () => {
	console.log('express listening on port 3000');
});
