'use strict';
const Server = require('ws').Server;
const events = require('events');

// Global event emitter
// Define events in your code that will send a websocket message
global.socketEmitter = new events.EventEmitter();
// messages awaiting acknowledgement. key is a message uuid, value is an object
// containing 3 properties: ws {WebSocket}, timer {Interval}, msg {wsMessage} 
const awaitingAck = {};
// channel maps. channelMaps' key = channel, value is a Map<string, WebSocket[]> whose
// key is a subscription id and value is an array of WebSocket connections
const channelMaps = {};
// connections map: key is a WebSocket connection, value is an object whose
// key is a channel and value is an array of subscription ids
// Object is structured like {channel: [subId]}
const connectionsMap = new Map();

const defaultWsConfig = {
	server: global.server,
	port: 30010
}
// cloud-ws options. Contains custom handlers, ack message type definitions 
// and broadcast message type definitions
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
	pubsubPublisher: null
};

module.exports = function socketServer(wsConfig, cloudWsOptions) {
	options = {...options, ...cloudWsOptions};
	wsConfig = {...defaultWsConfig, ...wsConfig};
	const wsServer = new Server(wsConfig);
	console.log(`WebSocket server fired up on port ${wsServer.address().port}`);
	
	wsServer.on('connection', (ws, req) => {
		ws.on('message', (message) => {
			const msg = JSON.parse(message);
			let ack = {type: 'error', value: `Message type "${msg.type}" not supported`, msg: msg};
			if (msg.type && msg.type === 'subscribe') {
				ack = subscribeChannel(ws, msg.channel, msg.subId);
				send(ws, ack);
			}else if (msg.type && msg.type === 'ack') {
				clearMessageAck(msg.id);
			}else if (msg.type && msg.type === 'announce') {
				ack = announce(ws, msg.channel, msg.subId, msg);
				if (ack) {
					send(ws, ack);
				}
			}else if (msg.type && msg.type === 'user') {
				ack = updateUser(ws, msg);
				send(ws, ack);
			}else if (msg.type && msg.type === 'unsubscribe') {
				ack = cleanupChannelConnections(ws, msg.channel, msg.subId);
				send(ws, ack);
			}else if (msg.type && msg.type === 'getInfo') {
				getInfo(ws, msg);
			}else if (msg.type && options.customMsgHandlers[msg.type]) {
				msg.id = msg.id ? msg.id : uuidv4();
				options.customMsgHandlers[msg.type](ws, msg);
				if (options.ackMessageTypes.indexOf(msg.type) > -1) {
					addToAwaitingAck(ws, msg);
				}
			}else{
				send(ws, ack);
			}
		});

		ws.on('close', (ws) => {
			cleanupConnections(ws);
		});
		
		ws.on('error', (err) => {
			console.error(err);
			cleanupConnections(ws);
		});

		if (!connectionsMap.has(ws)) {
			connectionsMap.set(ws, {});
			send(ws, {
				type: 'welcome', 
				message: 'Welcome to the cloud-sockets WebSocket', 
				numConnections: connectionsMap.size
			});
		}
	});
	if (options.pubsubListener) {
		options.pubsubListener();
	}
	return function(req, res, next) {
		next();
	}
}
/**
 * Create an uuid
 * @returns {string}
 */
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
/**
 * Send a payload to the supplied WebSocket and add the message to the
 * awaitingAck object
 * @param {WebSocket} ws
 * @param {any} payload This must be an object that may/may not be stringified
 */
function send(ws, payload) {
	if (ws && payload) {
		let updatedPayload = payload;
		if (typeof payload === 'string') {
			updatedPayload = JSON.parse(payload);
		}
		if (!updatedPayload.isRetry) {
			updatedPayload.id = uuidv4();
			updatedPayload.sentTimestamp = new Date().toISOString();
		}else{
			updatedPayload.lastRetryTimestamp = new Date().toISOString();
		}
		const msg = JSON.stringify(updatedPayload);
		ws.send(msg);
		if (updatedPayload.type !== 'ack' && updatedPayload.type !== 'welcome' && updatedPayload.type !== 'connectionInfo' && !updatedPayload.type.isRetry) {
			addToAwaitingAck(ws, updatedPayload);
		}
	}
}
/**
 * Add a message to the awaiting acknowledgement que
 * @param {WebSocket} ws 
 * @param {any} msg 
 */
function addToAwaitingAck(ws, msg) {
	const timer = setInterval(() => {
		msg.isRetry = true;
		send(ws, msg);
	}, 120000);
	awaitingAck[msg.id] = {ws: ws, timer: timer, msg: msg};
}
/**
 * Subscribe to a channel. Adds the provided connection to a subscription
 * id's WebSocket connections
 * @param {WebSocket} ws
 * @param {any} message
 */
function subscribeChannel(ws, channel, subId) {
	let ackMessage = {type: 'ack'};
	if (ws && channel && subId) {
		let channelMap = updateChannelMap(ws, channel, subId);
		let subConns = channelMap.get(subId);
		ackMessage = {subId: subId, channel: channel, type: 'ack', numConnections: subConns.length};
		updateConnectionObj(ws, channel, subId);
	}else{
		ackMessage = {type: 'error', value: 'No subId and/or channel property provided with subscription'};
	}
	return ackMessage;
}
/**
 * Update/Create a channel map. Will add the ws to the channel's map of connections for
 * the provided subId
 * @param {WebSocket} ws
 * @param {string} channel
 * @param {string} subId
 */
function updateChannelMap(ws, channel, subId) {
	let channelMap = channelMaps[channel];
	if (!channelMap) {
		channelMap = new Map();
	}
	let subConns = [];
	if (channelMap.has(subId)) {
		subConns = channelMap.get(subId);
	}
	subConns.push(ws);
	channelMaps[channel] = channelMap.set(subId, subConns);
	createEventListener(channel);
	return channelMaps[channel];
}
/**
 * Will update connection's object of connected channels in the connections map
 * @param {WebSocket} ws
 * @param {string} channel
 * @param {string} subId
 */
function updateConnectionObj(ws, channel, subId) {
	let returnVal = null;
	if (ws && channel) {
		let connectionObj = connectionsMap.get(ws);
		if (connectionObj && connectionObj[channel]) {
			connectionObj[channel] = [...connectionObj[channel], subId];
		}else{
			connectionObj[channel] = [subId];
		}
		returnVal = connectionObj[channel];
	}
	return returnVal;
}
/**
 * Remove the provided connection from the connectionsMap then cleanup
 * the connection from the channelMaps
 * @param {WebSocket} ws
 */
function cleanupConnections(ws) {
	const connObj = connectionsMap.get(ws);
	if (connObj) {
		const channelKeys = Object.keys(connObj);
		channelKeys.forEach((channel) => {
			cleanupChannelConnections(ws, channel);
			if (!channelMaps[channel]) {
				cleanupEventListener(channel);
			}
			connectionsMap.delete(ws);
		});
	}
}
/**
 * Provided a channel, will loop through all the subscriptions and if the provided
 * websocket is in the array of subscription connections, will remove the provided
 * websocket
 * @param {WebSocket} ws 
 * @param {string} channel 
 * @param {string} subId
 */
function cleanupChannelConnections(ws, channel, subId) {
	let payload = {type: 'ack', subId: subId, channel: channel, connectionsRemoved: 0};
	if (ws && channel) {
		const channelMap = channelMaps[channel];
		let removeCount = 0;
		if (channelMap && !subId) {
			[...channelMap.keys()].forEach((channelSubId) => {
				const subConns = channelMap.get(channelSubId);
				const idx = subConns.indexOf(ws);
				if (idx > -1) {
					subConns.splice(idx, 1);
					removeCount = removeCount + 1;
				}
				if (subConns.length) {
					channelMaps[channel].set(channelSubId, subConns);
				}else{
					channelMaps[channel].delete(channelSubId);
					if (!channelMaps[channel].size) {
						delete channelMaps[channel];
					}
				}
			});
		}else if (channelMap && subId) {
			const subConns = channelMap.get(subId);
			const idx = subConns.indexOf(ws);
			if (idx > -1) {
				subConns.splice(idx, 1);
				removeCount = removeCount + 1;
			}
			if (subConns.length) {
				channelMaps[channel].set(subId, subConns);
			}else{
				channelMaps[channel].delete(subId);
				if (!channelMaps[channel].size) {
					delete channelMaps[channel];
				}
			}
		}
		payload.connectionsRemoved = removeCount;
	}
	return payload;
}
/**
 * Cleanup the event listeners for the provided channel
 * @param {string} channel
 */
function cleanupEventListener(channel) {
	global.socketEmitter.off(channel, eventHandler);
}
/**
 * Create an event listener for the subscription
 * @param {string} channel
 */
function createEventListener(channel) {
	const listenerCount = global.socketEmitter.listenerCount(channel);
	if (listenerCount === 0) {
		global.socketEmitter.on(channel, eventHandler);
	}
}
/**
 * Event handler to send messages
 * @listens global.socketEmitter
 */
function eventHandler(channel, id, response) {
	if (options.pubsubPublisher) {
		const msg = {
			subId: id,
			type: 'announce',
			channel: channel,
			value: response
		};
		publishPubSubMessage(pubsubTopicName, msg)
		.catch((e) => {
			console.log(e)
		});
	}else{
		announce(null, channel, id, response);
	}
}
/**
 * Send a message to all connections for a channel
 * @param {string} channel 
 * @param {string} id 
 * @param {any} payload 
 */
function announce(ws, channel, subId, payload) {
	if (channel && subId && payload) {
		if (options.pubsubPublisher) {
			options.pubsubPublisher(channel, subId, payload);
		}else{
			const channelMap = channelMaps[channel];
			if (channelMap && channelMap.has(subId)) {
				channelMap.get(subId).forEach((wsConn) => {
					send(wsConn, payload);
				});
			}else{
				const errorMsg = channelMap ? `Channel map "${channel}" has no subscription with id "${subId}"` :
					`No channel map found for channel "${channel}"`;
				send(ws, {
					type: 'error',
					error: errorMsg
				});
			}
		}
	}
}
/**
 * Stops the resend interval and clears the awaiting acknoledgement message
 * with the supplied msgId
 * @param {string} msgId 
 */
function clearMessageAck(msgId) {
	if (awaitingAck[msgId]) {
		clearInterval(awaitingAck.timer);
		delete awaitingAck[msgId];
	}else{
		console.warn(`There is no message in the awaiting acknowledgement que with id ${msgId}`);
	}
}
/**
 * Will provide the connection information for a specific channel or all channels.
 * If there is no `channel` property in the msg, then it will return connection info
 * for all channels.
 * @param {WebSocket} ws 
 * @param {Message} msg
 * @sends {type: string, awaitingAck: string[], info: {channel: string, totalConnections: number, subInfo: {subId: string, numConnections: number}[]}}  
 */
function getInfo(ws, msg) {
	if (msg) {
		let payload = {
			type: 'connectionInfo',
			awaitingAck: Object.keys(awaitingAck),
			awaitingAckCount: Object.keys(awaitingAck).length,
			info: []
		}
		if (msg.channel) {
			const channelMap = channelMaps[msg.channel];
			const channelInfo = {
				channel: msg.channel,
				subInfo: getChannelMapSubInfo(channelMap)
			};
			channelInfo.totalConnections = getConnectionCount(channelInfo.subInfo);
			payload.info.push(channelInfo);
		}else{
			const channels = Object.keys(channelMaps);
			channels.forEach((channel) => {
				const channelMap = channelMaps[channel];
				const channelInfo = {
					channel: channel,
					subInfo: getChannelMapSubInfo(channelMap)
				};
				channelInfo.totalConnections = getConnectionCount(channelInfo.subInfo);
				payload.info.push(channelInfo);
			});
		}
		send(ws, payload);
	}
}
/**
 * Get the number of connections for each subscription in the channelMap
 * @param {Map<string, WebSocket>} channelMap 
 * @returns {{subId: string, numConnections: number}[]}
 */
function getChannelMapSubInfo(channelMap) {
	const returnVal = [];
	if (channelMap) {
		[...channelMap.keys()].forEach((subId) => {
			returnVal.push({
				subId: subId,
				numConnections: channelMap.get(subId).length
			});
		});
	}
	return returnVal;
}
/**
 * Given an array of subscription info items, will return the total number of connections
 * @param {{subId: string, numConnections: number}[]} subInfoArr 
 * @returns {number}
 */
function getConnectionCount(subInfoArr) {
	if (subInfoArr && subInfoArr.length) {
		if (subInfoArr.lenth === 1) {
			return subInfoArr[0].numConnections;
		}else{
			const totalConns = subInfoArr.reduce((subInfo_A, subInfo_B) => {
				if (subInfo_A.numConnections && subInfo_B.numConnections) {
					return subInfo_A.numConnections + subInfo_B.numConnections;
				}
				return 0;
			}, 0);
			return totalConns;
		}
	}
	return 0;
}
