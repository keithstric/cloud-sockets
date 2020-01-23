'use strict'
const Server = require('ws').Server;
const EventEmitter = require('events').EventEmitter;
const MessageDirector = require('./MessageDirector');
const ChannelManager = require('./ChannelManager');

global.socketEmitter = new EventEmitter();
/**
 * Map of connections. key is a WebSocket, value is an object whose
 * key is a subscribed to channel and value is an array of subscription ids
 * @type {Map<WebSocket, {<channel: string>: string[]}}
 */
const connectionsMap = new Map();
/**
 * WebSocket server configuration
 */
let wsConfig = {
	server: global.server,
	port: 30010
};
/**
 * default cloud-ws options
 */
let options = {
	/** 
	 * message types which require an acknowledgement 
	 * @type {string[]}
	 */
	ackMessageTypes: ['announce'],
	/** 
	 * custom message handlers. key is the message type, value is the handler function 
	 * the handler function will receive 2 properties, the WebSocket and message. If
	 * an acknowledgement is required, be sure your function returns a message
	 * @type {key: {string}, value: {function}}
	 */
	customMsgHandlers: {},
	/** 
	 * message types which will be broadcast to all connections 
	 * @type {string[]}
	 */
	broadcastMessageTypes: [],
	/**
	 * Optional: custom PubSub listener
	 * @type {function}
	 */
	pubsubListener: null,
	/**
	 * Optional: custom PubSub publisher. Will provide
	 * 3 arguments to function call: channel, subscriptionId and 
	 * payload (non stringified)
	 * @type {function}
	 */
	pubsubPublisher: null,
	msgResendDelay: 60000
};
/**
 * Websocket server
 * @type {Server}
 */
let wsServer;
/**
 * Message director
 * @type {MessageDirector}
 */
let msgDirector;
/**
 * Channel Manager
 * @type {ChannelManager}
 */
let channelMgr;

module.exports = function socketServer(serverConfig, cloudWsOptions) {
	options = {...options, ...cloudWsOptions};
	wsConfig = {...wsConfig, ...serverConfig};
	wsServer = new Server(wsConfig);
	console.log(`WebSocket server fired up on port ${wsServer.address().port}`);
	channelMgr = new ChannelManager();
	msgDirector = new MessageDirector(options, channelMgr);

	setupListeners();
	return function(req, res, next) {
		next();
	}
}
/**
 * Sets up the socket server event listeners
 */
function setupListeners() {
	wsServer.on('connection', (ws, req) => {
		if (!connectionsMap.has(ws)) {
			connectionsMap.set(ws, {});
			msgDirector.sendMessage(ws, {
				type: 'welcome', 
				message: 'Welcome to the cloud-sockets WebSocket', 
				numConnections: connectionsMap.size
			});
		}

		ws.on('message', (message) => {
			msgDirector.handleMsg(ws, message);
			const msg = JSON.parse(message);
			if (msg.type === 'subscribe') {
				onSubscribe(ws, msg);
			}else if (msg.type === 'unsubscribe') {
				onUnsubscribe(ws, msg);
			}else if (msg.type === 'getInfo') {
				getInfo(ws, msg);
			}
		});
		ws.on('error', (err) => {
			console.error(err);
			cleanupConnections(ws);
		});
		ws.on('close', (ws) => {
			cleanupConnections(ws);
		});
	});
}
/**
 * Cleans up the connections after an error or close connection
 */
function cleanupConnections(ws) {
	const connObj = connectionsMap.get(ws);
	if (connObj) {
		const channelKeys = Object.keys(connObj);
		const acks = [];
		channelKeys.forEach((channel) => {
			acks.push(channelMgr.unsubscribeChannel(ws, channel));
		});
		connectionsMap.delete(ws);
	}
}
/**
 * Adds subscriptions to the connection object for the provided WebSocket
 * @param {WebSocket} ws 
 * @param {any} msg 
 */
function onSubscribe(ws, msg) {
	if (ws && msg) {
		const {channel, subId} = msg;
		const connObj = connectionsMap.get(ws);
		if (connObj && connObj[channel]) {
			connObj[channel] = [...connObj[channel], subId];
		}else{
			connObj[channel] = [subId]
		}
	}
}
/**
 * Removes subscriptions from the connection object for the provided WebSocket
 * @param {WebSocket} ws 
 * @param {any} msg 
 */
function onUnsubscribe(ws, msg) {
	if (ws && msg) {
		const {channel, subId} = msg;
		const connObj = connectionsMap.get(ws);
		if (connObj && connObj[channel]) {
			if (subId) {
				const subIdx = connObj[channel].indexOf(subId);
				if (subIdx > -1) {
					connObj[channel].splice(subIdx, 1);
				}
			}else{
				delete connObj[channel];
			}
		}
	}
}
/**
 * Gathers information from the MessageHandler and ChannelManager then
 * includes information about the configuration and connections
 * and sends it back to the requestor
 * @param {WebSocket} ws 
 * @param {any} msg 
 */
function getInfo(ws, msg) {
	const info = msgDirector.getInfo(ws, msg.channel);
	info.totalConnections = connectionsMap.size;
	info.type = 'getInfo';
	info.customPubSub = !!(options.pubsubListener && options.pubsubPublisher);
	info.ackMessageTypes = options.ackMessageTypes;
	info.customMsgHandlers = Object.keys(options.customMsgHandlers);
	info.msgResendDelay = options.msgResendDelay + 'ms';
	msgDirector.sendMessage(ws, info);
}
