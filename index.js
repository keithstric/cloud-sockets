
'use strict';
const Server = require('ws').Server;
const events = require('events');

// Global event emitter
// Define events in your code that will send a websocket message
global.socketEmitter = new events.EventEmitter();
// messages awaiting acknowledgement. key is a message uuid value is the sent message
const awaitingAck = {};
// channel maps. channelMaps' key = channel, value is a Map<string, WebSocket[]> whose
// key is a subscription id and value is an array of WebSocket connections
const channelMaps = {};
// connections map: key is a WebSocket connection, value is an object whose
// key is a channel and value is an array of subscription ids
// Object is structured like {channel: [subId]}
const connectionsMap = new Map();

export default function(config) {
	const wsServer = new Server(config);

	wsServer.on('connection', (ws, req) => {

		ws.on('message', (ws, evt) => {
			const msg = evt.data;
			if (msg && typeof msg === 'string') {
				msg = JSON.parse();
			}
			let ack = {type: 'error', value: 'Message type not supported', msg: msg};
			if (msg.type && msg.type === 'subscribe') {
				ack = subscribeChannel(ws, msg);
				send(ws, ack);
			}else if (msg.type && msg.type === 'ack') {
				updateAck(msg.id);
			}else if (msg.type && msg.type === 'announce') {
				ack = announce(msg.channel);
				send(ws, ack);
			}else if (msg.type && msg.type === 'user') {
				ack = updateUser(ws, msg);
				send(ws, ack);
			}
		});
		ws.on('close', (ws) => {
			cleanupConnections(ws);
		});
		ws.on('error', (err) => {})

		if (!connectionsMap.has(ws)) {
			connectionsMap.set(ws, {});
		}
	});

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
	let updatedPayload = payload;
	if (typeof payload === 'string') {
		updatedPayload = JSON.parse(payload);
	}
	updatedPayload.id = uuidv4();
	let msg = updatedPayload;
	msg = JSON.stringify(updatedPayload);
	ws.send(msg);
	awaitingAck[updatedPayload.id] = updatedPayload;
}
/**
 * Subscribe to a channel. Adds the provided connection to a subscription
 * id's WebSocket connections
 * @param {WebSocket} ws
 * @param {any} message
 */
function subscribeChannel(ws, message) {
	let ackMessage = {type: 'ack'};
	if (ws && message) {
		let msg = message;
		if (typeof msg === 'string') {
			msg = JSON.parse(message);
		}
		if (msg.subId && msg.channel) {
			let subMap = updateChannelMap(ws, msg.channel, msg.subId);
			let subConns = subMap.get(msg.subId);
			ackMessage = {subId: msg.subId, channel: msg.channel, type: 'ack', numConnections: subConns.length};
			updateConnectionObj(ws, msg.channel, msg.subId);
		}else{
			ackMessage = {type: 'error', value: 'No subId and/or channel property provided with subscription'};
		}
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
	return channelMaps[chanel];
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
	const channelSubs = [];
	if (connObj) {
		const channelKeys = Object.keys(connObj);
		channelKeys.forEach((key) => {
			const subs = channelMaps[key];
			channelSubs.push({channel: key, subs: subs});
			connectionsMap.delete(ws);
		});
		cleanupChannels(ws, channelSubs);
	}
}
/**
 * Remove the provided connection from the channel subscription connections
 * @param {WebSocket} ws
 * @param {[{channel: string, subs: [string]}]} channelSubs
 */
function cleanupChannels(ws, channelSubs) {
	if (channelSubs && channelSubs.length) {
		channelSubs.forEach((channelObj) => {
			const channelMap = channelMaps[channelObj.channel];
			channelObj.subs.forEach((sub) => {
				if (channelMap.has(sub)) {
					const conns = channelMap.get(sub);
					const connIdx = conns.indexOf(ws);
					if (connIdx > -1) {
						conns.slice(connIdx, 1);
						if (conns.length) {
							channelMap.set(sub, conns);
							channelMaps[channelObj.channel] = channelMap;
						}else{
							delete channelMaps[channelObj.channel];
							cleanupEventListeners(channelObj.channel);
						}
					}
				}
			});
		});
	}
}
/**
 * Cleanup the event listeners for the provided channel
 * @param {string} channel
 */
function cleanupEventListeners(channel) {
	global.socketEmitter.off(channel, eventHandler);
}
/**
 * Create an event listener for the subscription
 * @param {string} channel
 */
function createEventListener(channel) {
	if (!global.socketEmitter.listeners(channel)) {
		global.socketEmitter.on(channel, eventHandler);
	}
}
/**
 * Event handler to send messages
 * @listens global.socketEmitter
 */
function eventHandler(evt) {
	const payload = evt.data;
	if (payload.subId && payload.channel) {
		this.send(payload);
	}
}
