
const ChannelManager = require('./ChannelManager').ChannelManager;

class MessageDirector {
	/**
	 * The message director handles the processing of all messages and maintains the que of any
	 * messages awaiting an acknowledgement from the client
	 * @param {string[]} acknowledgementTypes Array of message types which the client should acknowledge
	 * @param {{<key: string>: function}} customMessageHandlers key is a message type whose value is the handler function
	 * @param {ChannelManager} channelMgr?
	 * @returns {MessageDirector}
	 */
	constructor(options, channelMgr) {
		this.acknowledgementTypes = [...options.ackMessageTypes, 'announce'];
		this.customMessageHandlers = {...options.customMessageHandlers};
		this.awaitingRetryDelay = options.msgResendDelay;
		this.channelMgr = channelMgr || new ChannelManager();
		this.customPubSubPublisher = options.pubsubPublisher;
		/**
		 * @todo replace the object with a map because we need an
		 * acknowledgement from every WebSocket that a message was
		 * send to, not just a single acknowledgement
		 * @type {Map<WebSocket, <subId: string>[]}
		 */
		this.awaitingAck = new Map();
	}
	/**
	 * Provided a message, will decide what to do with that message based on the
	 * message's type property
	 * @param {WebSocket} ws 
	 * @param {any} message 
	 */
	handleMsg(ws, message) {
		if (message) {
			const msg = JSON.parse(message);
			const {type} = msg;
			let ack = {type: 'error', value: `Message type "${msg.type}" not supported`, msg: msg};
			switch (type) {
				case 'subscribe':
					this._subscribe(ws, msg.channel, msg.subId);
					break;
				case 'ack':
					this._removeAwaitingAck(msg.ackId);
					break;
				case 'unsubscribe':
					this._unsubscribe(ws, msg.channel, msg.subId);
					break;
				case 'announce':
					this._announce(msg, msg.channel, msg.subId);
					break;
				case 'user':
					break;
				case 'getInfo':
					break;
				default:
					if (msg.type && this.customMessageHandlers[msg.type]) {
						this.customMessageHandlers[msg.type](ws, msg);
					}else{
						this.sendMessage(ws, ack);
					}
			}
		}
	}
	/**
	 * Subscribe to a subscription inside a channel
	 * @param {WebSocket} ws 
	 * @param {string} channel 
	 * @param {string} subId 
	 */
	_subscribe(ws, channel, subId) {
		const ack = this.channelMgr.subscribeChannel(ws, channel, subId);
		this.sendMessage(ws, ack);
	}
	/**
	 * Unsubscribe from a subscription. If no subId is provided will unsubscribe from all
	 * subscriptions in a channel
	 * @param {WebSocket} ws 
	 * @param {string} channel 
	 * @param {string} subId? 
	 */
	_unsubscribe(ws, channel, subId) {
		const ack = this.channelMgr.unsubscribeChannel(ws, channel, subId);
		this.sendMessage(ws, ack);
	}
	/**
	 * Send a message to all connections, a specific channel's connections or
	 * a subscription's connections. If no subId, will send to entire channel
	 * if no channel will send to everybody
	 * @param {any} msg 
	 * @param {string} channel?
	 * @param {string} subId?
	 */
	_announce(msg, channel, subId) {
		let conns = [];
		if (channel) {
			if (subId) {
				conns = this.channelMgr.getChannelSubConnections(channel, subId);
			}else{
				conns = this.channelMgr.getChannelConnections(channel);
			}
		}else{
			conns = this.channelMgr.getAllConnections();
		}
		conns.forEach((ws) => {
			this.sendMessage(ws, msg);
		});
	}
	/**
	 * Get information about the various channels, subscriptions and messages
	 * awaiting acknowledgement. If a channel is provided will only return info
	 * about that channel. If a channel is not provided will provide info about
	 * all channels.
	 * @param {string} channel?
	 */
	getInfo(ws, channel) {
		const info = this.channelMgr.getInfo(channel);
		info.awaitingAck = Object.keys(this.awaitingAck);
		info.awaitingAckCount = info.awaitingAck.length;
		return info;
	}
	/**
	 * Send a payload to the supplied WebSocket and add the message to the
	 * awaitingAck object if needed
	 * @param {WebSocket} ws
	 * @param {any} payload This must be an object that may/may not be stringified
	 */
	sendMessage(ws, msg) {
		if (ws && msg) {
			let msgObj = msg;
			if (typeof msg === 'string') {
				msgObj = JSON.parse(msg);
			}
			if (!msgObj.isRetry) {
				msgObj.id = this.uuidv4();
				msgObj.sentDateTime = new Date().toISOString();
			}else{
				msgObj.lastRetryDateTime = new Date().toISOString();
			}
			const message = JSON.stringify(msgObj);
			ws.send(message);
			if (this.acknowledgementTypes.indexOf(msgObj.type) > -1 && !msgObj.isRetry) {
				this._addAwaitingAck(ws, msgObj);
			}
		}else{
			// throw error?
		}
	}
	/**
	 * Add a message to the awaitingAck object
	 * @param {WebSocket} ws 
	 * @param {any} msg 
	 */
	_addAwaitingAck(ws, msg) {
		if (ws && msg) {
			const awaitingObj = {
				ws: ws,
				timer: setInterval(() => {
					msg.isRetry = true;
					this.sendMessage(ws, msg);
				}, this.awaitingRetryDelay),
				msg: msg
			}
			this.awaitingAck[msg.id] = awaitingObj;
		}
	}
	/**
	 * Remove a message from the awaitingAck object and stop
	 * the interval for resending the message
	 * @param {string} ackId 
	 */
	_removeAwaitingAck(ackId) {
		if (ackId) {
			const awaitingObj = this.awaitingAck[ackId];
			if (awaitingObj) {
				clearInterval(awaitingObj.timer);
				delete this.awaitingAck[ackId]
			}
		}
	}
	/**
	 * Create a uuid
	 * @returns {string}
	 */
	uuidv4() {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	}
}

module.exports = MessageDirector;
