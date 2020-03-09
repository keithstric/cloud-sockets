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
/**
 * @property {function} pubsubListener - listens for messages from pubsub system
 * @property {function} pubsubPublisher - publishes message to pubsub system
 * @property {string} pubsubTopicName - The pubsub topic
 * @property {string} pubSubSubscriptionName
 * @property {string[]} pubsubMessageTypes - The types of messages to send through pubsub
 */
const socketOptions = {
	pubsubListener: pubSubFunctions.listenForPubSubMessages,
	pubsubPublisher: pubSubFunctions.publishPubSubMessages,
	pubsubTopicName: 'some-topic-name',
	pubSubSubscriptionName: 'api-service',
	pubsubMessageTypes: ['announceEvent']
};
// Define the cloud-sockets middleware after all your other middleware
const cloudSockets = require('../../index');
global.server.use(cloudSockets.socketServer({server: global.server, port: 8080}, socketOptions));
// Startup the express server
global.server.listen(3000, () =>{
	console.log(`gcloud-pubsub example listening on port 3000`);
});
