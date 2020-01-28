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
	ackMessageTypes: [],
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
	/**
	 * message types that should be sent along to PubSub
	 * @type {string[]}
	 */
	pubsubMessageTypes: [],
	pubsubTopicName: null,
	pubsubSubscriptionName: null,
	/**
	 * The number of milliseconds to wait before attempting to resend
	 * a message that requires acknowledgement
	 * @type {number}
	 */
	msgResendDelay: 60000,
	setupHttpUser: false,
	includeUserProps: []
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
	channelMgr = new ChannelManager(options);
	msgDirector = new MessageDirector(options, channelMgr);
	setupListeners();
	console.log(`WebSocket server fired up on port ${wsServer.address().port}`);
	
	// Middleware function
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
			}else if (msg.type === 'getInfoDetail') {
				getInfoDetail(ws, msg);
			}else if (msg.type === 'getInfo') {
				getInfo(ws, msg);
			}
		});
		ws.on('error', (err) => {
			console.error(err);
			cleanupConnections(ws);
		});
		ws.on('close', () => {
			const connObj = connectionsMap.get(ws);
			cleanupConnections(connObj);
			connectionsMap.delete(ws);
		});
	});

	if (options.pubsubListener && options.pubsubSubscriptionName) {
		const subscription = options.pubsubListener(options.pubsubSubscriptionName);
		subscription.on('message', pubsubHandler);
	}
}
/**
 * Cleans up the connections after an error or close connection
 */
function cleanupConnections(connObj) {
	if (connObj) {
		const channelKeys = Object.keys(connObj);
		const acks = [];
		channelKeys.forEach((channel) => {
			acks.push(channelMgr.unsubscribeChannel(ws, channel));
		});
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
		const connObj = connectionsMap.get(ws) || {};
		if (connObj && connObj[channel]) {
			connObj[channel] = [...connObj[channel], subId];
		}else{
			connObj[channel] = [subId]
		}
		createEventListener(channel);
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
		const channelConns = channelMgr.getChannelConnections(channel);
		if (channelConns && !channelConns.length) {
			global.socketEmitter.removeListener(channel, eventHandler);
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
function getInfoDetail(ws, msg) {
	let info = {
		serverInfo: {},
		connectionInfo: {}
	};
	info.connectionInfo.totalConnections = connectionsMap.size;
	info.type = 'getInfoDetail';
	info.serverInfo.customPubSub = !!(options.pubsubListener && options.pubsubPublisher);
	info.serverInfo.ackMessageTypes = options.ackMessageTypes;
	info.serverInfo.customMsgHandlers = Object.keys(options.customMsgHandlers);
	info.serverInfo.msgResendDelay = options.msgResendDelay + 'ms';
	info.serverInfo.serverPort = wsServer.address.port;
	info = {...info, ...msgDirector.getInfoDetail(msg.channel)}
	msgDirector.sendMessage(ws, info);
}

function getInfo(ws, msg) {
	let info = {
		serverInfo: {},
		connectionInfo: {}
	};
	info.connectionInfo.totalConnections = connectionsMap.size;
	info.type = 'getInfoDetail';
	info.serverInfo.customPubSub = !!(options.pubsubListener && options.pubsubPublisher);
	info.serverInfo.ackMessageTypes = options.ackMessageTypes;
	info.serverInfo.customMsgHandlers = Object.keys(options.customMsgHandlers);
	info.serverInfo.msgResendDelay = options.msgResendDelay + 'ms';
	info.serverInfo.serverPort = wsServer.address.port;
	info = {...info, ...msgDirector.getInfo(msg.channel)}
	msgDirector.sendMessage(ws, info);
}
/**
 * Creates an event listener for the defined type. Type comes from the
 * subscription message from the client.
 * @param {string} channel
 */
function createEventListener(channel) {
	const listenerCount = global.socketEmitter.listenerCount(channel);
	if (listenerCount === 0) {
		global.socketEmitter.addListener(channel, eventHandler);
		// console.log(`createEventListener, created listener for ${channel}, we now have ${global.websocketEmitter.listenerCount(channel)} listeners`);
	}
}
/**
 * Event handler to send messages. These parameters should be provided
 * by the emit call
 * @param {string} channel
 * @param {string} subId
 * @param {string} type
 * @param {any} payload - The payload produced when the event is emitted
 * @listens global.socketEmitter
 */
function eventHandler(channel, subId, type, payload) {
	const message = {
		channel: channel,
		subId: subId,
		type: type,
		payload: payload
	};
	msgDirector.handleMsg(null, message);
}
/**
 * Handles messages from PubSub
 * @param {Message} message 
 */
function pubsubHandler(message) {
	if (message) {
		message.ack();
		if (message.data) {
			let response = JSON.parse(message.data);
			response.pubsubId = message.id;
			const {subId, channel} = response;
			// We can't just pass it on to the msgDirector.handleMessage because we'll end up in a loop
			msgDirector.announce(response, channel, subId);
		}
	}
}
