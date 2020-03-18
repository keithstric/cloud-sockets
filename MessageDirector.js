const ChannelManager = require('./ChannelManager');

/**
 * This class is responsible for the sending and handling of all messages to and from
 * the server
 * @class {MessageDirector}
 */
class MessageDirector {
	/**
	 * The message director handles the processing of all messages and maintains the que of any
	 * messages awaiting an acknowledgement from the client
	 * @param {any} options
	 * @param {ChannelManager} channelMgr?
	 * @returns {MessageDirector}
	 */
	constructor(options, channelMgr) {
		if (options) {
			this.acknowledgementTypes = [...options.ackMessageTypes];
			this.customMsgHandlers = {...options.customMsgHandlers};
			this.awaitingRetryDelay = options.msgResendDelay;
			this.pubsubPublisher = options.pubsubPublisher;
			this.pubsubTopic = options.pubsubTopicName;
			this.pubsubMessageTypes = options.pubsubMessageTypes;
		}
		this.channelMgr = channelMgr || new ChannelManager(options);
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
			switch (type) {
				case 'subscribe':
					this.subscribe(ws, msg.channel, msg.subId);
					break;
				case 'ack':
					this._removeAwaitingAck(ws, msg);
					break;
				case 'unsubscribe':
					this.unsubscribe(ws, msg.channel, msg.subId);
					break;
				case 'announce':
					this.announce(ws, msg, msg.channel, msg.subId);
					break;
				case 'getInfo':
					break;
				case 'getInfoDetail':
					break;
				case 'notification':
					this.notifyUser(ws, msg, msg.userTag);
					break;
				case 'broadcast':
					// Do Nothing, handled in index.js. Just don't throw an error
					break;
				default:
					if (msg.type && this.customMsgHandlers && this.customMsgHandlers[msg.type]) {
						const formattedMsg = this.formatMessage(msg);
						this.customMsgHandlers[msg.type](ws, formattedMsg, this);
					} else if (msg.type && this.pubsubMessageTypes && this.pubsubMessageTypes.indexOf(msg.type) > -1) {
						if (this.pubsubPublisher && this.pubsubTopic) {
							const formattedMsg = this.formatMessage(msg);
							this.pubsubPublisher(this.pubsubTopic, formattedMsg);
						}
					} else {
						let err = {type: 'error', value: `Message type "${msg.type}" not supported`, msg: msg};
						this.sendMessage(ws, err);
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
	subscribe(ws, channel, subId) {
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
	unsubscribe(ws, channel, subId) {
		const ack = this.channelMgr.unsubscribeChannel(ws, channel, subId);
		this.sendMessage(ws, ack);
	}

	/**
	 * Send a message to all connections, a specific channel's connections or
	 * a subscription's connections. If no subId, will send to entire channel
	 * if no channel will send to everybody. The originating WebSocket will not
	 * receive this message
	 * @param {WebSocket} origWs - Originating WebSocket or null
	 * @param {any} msg
	 * @param {string} channel?
	 * @param {string} subId?
	 */
	announce(origWs, msg, channel, subId) {
		let conns = [];
		if (channel) {
			if (subId) {
				conns = this.channelMgr.getChannelSubConnections(channel, subId);
			} else {
				conns = this.channelMgr.getChannelConnections(channel);
			}
		} else {
			conns = this.channelMgr.getAllConnections();
		}
		conns.forEach((ws) => {
			if (ws !== origWs) {
				this.sendMessage(ws, msg);
			}
		});
	}

	/**
	 * Send a notification directly to a user
	 * @param {WebSocket} origWs
	 * @param {any} msg
	 * @param {string} userTag
	 */
	notifyUser(origWs, msg, userTag) {
		let conns = [];
		if (userTag) {
			conns = this.channelMgr.getUserConnections(userTag);
		}
		if (conns.length) {
			conns.forEach((ws) => {
				if (ws !== origWs) { // todo: Should we include the sending connection?
					this.sendMessage(ws, msg);
				}
			});
		}else{
			if (this.pubsubPublisher) {
				// we need to take into account that the user may be on another instance, so if the user is offline and there is a pubsub publisher, we should use that instead
				this.pubsubPublisher(this, msg); // todo: needs to be tested
			}else{
				const notOnlineMsg = {
					type: 'notification',
					payload: `User with user tag ${userTag} is not online`
				};
				this.sendMessage(origWs, notOnlineMsg);
			}
		}
	}

	/**
	 * Get information about the various channels, subscriptions and messages
	 * awaiting acknowledgement. If a channel is provided will only return info
	 * about that channel. If a channel is not provided will provide info about
	 * all channels.
	 */
	getInfoDetail() {
		const info = this.getInfo();
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

	/**
	 * Get the basic information about the MessageDirector
	 */
	getInfo() {
		let info = {
			messageInfo: {
				totalConnectionsAwaitingAck: this.awaitingAck.size
			},
		};
		let totalAwaitingMsgs = 0;
		const awaitingKeys = [...this.awaitingAck.keys()];
		awaitingKeys.forEach((ws) => {
			const awaitingMsgsLen = this.awaitingAck.get(ws).length;
			totalAwaitingMsgs = totalAwaitingMsgs + awaitingMsgsLen;
		});
		info.messageInfo.totalAwaitingMsgs = totalAwaitingMsgs;
		return info;
	}

	/**
	 * Send a payload to the supplied WebSocket and add the message to the
	 * awaitingAck object if needed
	 * @param {WebSocket} ws
	 * @param {any} msg This must be an object that may/may not be stringified
	 */
	sendMessage(ws, msg) {
		if (ws && msg) {
			let msgObj = msg;
			if (msg && typeof msg === 'string') {
				msgObj = JSON.parse(msg);
			}
			const message = this.formatMessage(msg);
			ws.send(message);
			if (this.acknowledgementTypes && this.acknowledgementTypes.indexOf(msgObj.type) > -1 && !msgObj.isRetry) {
				this._addAwaitingAck(ws, msgObj);
			}
		} else {
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
	 * @param {WebSocket} ws
	 * @param {any} msg
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
					} else {
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
	_uuidv4() {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	}

	/**
	 * Gets a message ready for sending. Adds an id and sentDateTime properties
	 * then stringifies it.
	 * @param {any} msg
	 */
	formatMessage(msg) {
		let msgObj = msg;
		if (typeof msg === 'string') {
			msgObj = JSON.parse(msg);
		}
		if (!msgObj.isRetry) {
			msgObj.id = !msg.id ? this._uuidv4() : msg.id;
			msgObj.sentDateTime = new Date().toISOString();
		} else {
			msgObj.lastRetryDateTime = new Date().toISOString();
		}
		return JSON.stringify(msgObj);
	}
}

module.exports = MessageDirector;
