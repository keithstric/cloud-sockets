'use strict'
const express = require('express');
const http = require('http');
// Define your basic express setup
const app = express();
global.server = http.createServer(app);
// Define your middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Setup your custom-message handlers
const customHandlers = require('./cloud-sockets-impl');
/**
 * customMsgHandlers should be an object, whose keys are the message types with a value
 * of a function which does something. This function will have the following arguments
 * provided: WebSocket, the message and the current instance of the MessageDirector
 * @property {{<messageType>:string : handler:function}} customMsgHandlers
 */
const socketOptions = {
	customMsgHandlers: {'customMessageType': customHandlers.customMsgHandler}
};
// Define the cloud-sockets middleware after all your other middleware
const cloudSockets = require('../../index');
app.use(cloudSockets.socketServer(null, socketOptions));
// Startup the express server
global.server.listen(3000, () =>{
	console.log(`gcloud-pubsub example listening on port 3000`);
});
