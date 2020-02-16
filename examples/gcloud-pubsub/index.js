'use strict'
const express = require('express');
const http = require('http');
const socketServer = require('../../index');
const pubSubFunctions = require('./cloud-sockets-impl');

const app = express();
global.server = http.createServer(app);

global.server.use(express.json());
global.server.use(express.urlencoded({extended: true}));

const socketOptions = {
	pubsubListener: pubSubFunctions.gcloudPubsubListener,
	pubsubPublisher: pubSubFunctions.gcloudPubsubPublisher,
	pubsubTopicName: 'some-topic-name',
	pubSubSubscriptionName: 'api-service',
	pubsubMessageTypes: ['announceEvent']
};
global.server.use(socketServer({server: global.server, port: 8080}, socketOptions));

global.server.listen(3000, () =>{
	console.log(`gcloud-pubsub example listening on port 3000`);
});
