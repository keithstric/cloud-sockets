'use strict'
const express = require('express');
const http = require('http');
const socketServer = require('../../index');
const customHandlers = require('./cloud-sockets-impl');

const app = express();
global.server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({extended: true}));

const socketOptions = {
	customMsgHandlers: {'customMessageType': customHandlers.customMsgHandler}
};
app.use(socketServer(null, socketOptions));

global.server.listen(3000, () =>{
	console.log(`gcloud-pubsub example listening on port 3000`);
});
