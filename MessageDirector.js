const ChannelManager = require('./ChannelManager').ChannelManager;

/**
 * This class is responsible for the sending and handling of all messages to and from
 * the server
 * @class {MessageDirector}
 */
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
		this.acknowledgementTypes = [...options.ackMessageTypes];
		this.customMessageHandlers = {...options.customMessageHandlers};
		this.awaitingRetryDelay = options.msgResendDelay;
		this.channelMgr = channelMgr || new ChannelManager();
		this.pubsubPublisher = options.pubsubPublisher;
		this.pubsubTopic = options.pubsubTopic;
		/**
		 * @type {Map<WebSocket, <subId: string>[]>}
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
					this._removeAwaitingAck(ws, msg);
					break;
				case 'unsubscribe':
					this._unsubscribe(ws, msg.channel, msg.subId);
					break;
				case 'announce':
					this.announce(msg, msg.channel, msg.subId);
					break;
				case 'user':
					break;
				case 'getInfo':
					break;
				case 'getInfoDetail':
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
	announce(msg, channel, subId) {
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
			if (this.pubsubPublisher) {
				// TODO: Need to reinvistigate this, I don't think this is quite right as it will probably cause an endless loop
				const dataBuffer = Buffer.from(this._formatMessage(msg));
				this.pubsubPublisher(this.pubsubTopic, dataBuffer);
			}else{
				this.sendMessage(ws, msg);
			}
		});
	}
	/**
	 * Get information about the various channels, subscriptions and messages
	 * awaiting acknowledgement. If a channel is provided will only return info
	 * about that channel. If a channel is not provided will provide info about
	 * all channels.
	 * @param {string} channel?
	 */
	getInfoDetail(channel) {
		const channelMgrInfo = this.channelMgr.getInfoDetail(channel);
		const info = {...this.getInfo(channel), ...channelMgrInfo};
		// const info = this.getInfo(channel);
		// info.channelInfo = channelMgrInfo.channelInfo;
		let awaitingMsgArr = [];
		const awaitingKeys = [...this.awaitingAck.keys()];
		awaitingKeys.forEach((ws) => {
			const awaitingMsgs = this.awaitingAck.get(ws);
			const awaitingIds = awaitingMsgs.map(awaitingObj => awaitingObj.msg.id);
			awaitingMsgArr = [...awaitingMsgArr, ...awaitingIds];
		});
		info.messageInfo.awaitingMessages = awaitingMsgArr;
		return info;
	}

	getInfo(channel) {
		let channelInfo = this.channelMgr.getInfo(channel);
		channelInfo.messageInfo = {};
		channelInfo.messageInfo.totalConnectionsAwaitingAck = this.awaitingAck.size;
		let totalAwaitingMsgs = 0;
		const awaitingKeys = [...this.awaitingAck.keys()];
		awaitingKeys.forEach((ws) => {
			const awaitingMsgsLen = this.awaitingAck.get(ws).length;
			totalAwaitingMsgs = totalAwaitingMsgs + awaitingMsgsLen;
		});
		channelInfo.messageInfo.totalAwaitingMsgs = totalAwaitingMsgs;
		return channelInfo;
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
			if (msg && typeof msg === 'string') {
				msgObj = JSON.parse(msg);
			}
			const message = this._formatMessage(msg);
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
				timer: setInterval(() => {
					msg.isRetry = true;
					this.sendMessage(ws, msg);
				}, this.awaitingRetryDelay),
				msg: msg
			}
			let wsMsgs = [awaitingObj];
			if (this.awaitingAck.has(ws)) {
				wsMsgs = this.awaitingAck.get(ws);
			}
			this.awaitingAck.set(ws, wsMsgs);
		}
	}
	/**
	 * Remove a message from the awaitingAck object and stop
	 * the interval for resending the message
	 * @param {string} ackId
	 */
	_removeAwaitingAck(ws, msg) {
		if (ws && msg) {
			if (this.awaitingAck.has(ws)) {
				let wsMsgs = this.awaitingAck.get(ws);
				let awaitingObjIdx = -1;
				const awaitingObj = wsMsgs.find((awaitingObj, idx) => {
					if (awaitingObj.msg.id === msg.id) {
						awaitingObjIdx = idx;
						return true;
					}
					return false;
				});
				if (awaitingObjIdx > -1) {
					clearInterval(awaitingObj.timer);
					wsMsgs.splice(awaitingObjIdx, 1);
					if (!wsMsgs.length) {
						this.awaitingAck.delete(ws);
					}else{
						this.awaitingAck.set(ws, wsMsgs);
					}
				}
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
	/**
	 * Gets a message ready for sending. Adds an id and sentDateTime properties
	 * then stringifies it.
	 * @param {any} msg
	 */
	_formatMessage(msg) {
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
		return JSON.stringify(msgObj);
	}
}

module.exports = MessageDirector;
