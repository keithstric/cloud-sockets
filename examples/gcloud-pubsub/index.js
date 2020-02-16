'use strict'
const express = require('express');
const http = require('http');
// Define your basic express setup
const app = express();
global.server = http.createServer(app);
// Define your middleware
global.server.use(express.json());
global.server.use(express.urlencoded({extended: true}));

// Setup you pubsub configuration
const pubSubFunctions = require('./cloud-sockets-impl');
const socketOptions = {
	pubsubListener: pubSubFunctions.gcloudPubsubListener,
	pubsubPublisher: pubSubFunctions.gcloudPubsubPublisher,
	pubsubTopicName: 'some-topic-name',
	pubSubSubscriptionName: 'api-service',
	pubsubMessageTypes: ['announceEvent']
};
// Define the cloud-sockets middleware after all your other middleware
const socketServer = require('../../index');
global.server.use(socketServer({server: global.server, port: 8080}, socketOptions));
// Startup the express server
global.server.listen(3000, () =>{
	console.log(`gcloud-pubsub example listening on port 3000`);
});
