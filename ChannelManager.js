/**
 * This class manages the channel subscriptions which is at the heart
 * of the cloud-sockets project. It is responsible for maintaining an
 * object of channels whose value is a map with a key of a subscription id
 * and a value that is an array of WebSocket.
 * @class {ChannelManager}
 */
class ChannelManager {

	constructor(options) {
		/**
		 * Channel maps
		 * @type {{[key: string]: Map<string, WebSocket[]>}}
		 */
		this.channelMaps = {};
		/**
		 * A map of users.The key will be items in the includeUserProps array or the user id and
		 * the value will be that user's WebSocket connection. This is used
		 * mainly for user notifications via @someUser
		 * @type {Map<string, WebSocket[]>}
		 */
		this.userMap = new Map();
		this.includeUserProps = options ? options.includeUserProps : [];
	}

	/**
	 * Get a channel map
	 * @param {string} channel
	 * @returns {Map<string, WebSocket[]>}
	 */
	getChannelMap(channel) {
		return this.channelMaps[channel];
	}

	/**
	 * Set a channel map
	 * @param {string} channel
	 * @param {Map<string, WebSocket[]>} channelMap
	 * @returns {Map<string, WebSocket[]>}
	 */
	setChannelMap(channel, channelMap) {
		if (!channelMap) {
			channelMap = new Map();
		}
		this.channelMaps[channel] = channelMap;
		return this.channelMaps[channel];
	}

	/**
	 * Get a channel subscription's connections
	 * @param {string} channel
	 * @param {string} subId
	 */
	getChannelSubConnections(channel, subId) {
		const channelMap = this.getChannelMap(channel);
		if (channelMap && channelMap.has(subId)) {
			return channelMap.get(subId);
		}
		return [];
	}

	/**
	 * Get all the connections for a specific channel
	 * @param {string} channel
	 * @returns {WebSocket[]}
	 */
	getChannelConnections(channel) {
		let allConns = [];
		if (channel) {
			const channelMap = this.getChannelMap(channel);
			if (channelMap) {
				[...channelMap.keys()].forEach((subId) => {
					allConns = [...allConns, ...channelMap.get(subId)];
				});
			}
		}
		return allConns;
	}

	/**
	 * Get all the connections for all channels
	 * @returns {WebSocket[]}
	 */
	getAllConnections() {
		const channels = Object.keys(this.channelMaps);
		let conns = [];
		channels.forEach((channel) => {
			const channelConns = this.getChannelConnections(channel);
			conns = [...conns, ...channelConns];
		});
		return conns;
	}

	/**
	 * Subscribes to a channel subscription. This adds the provided
	 * WebSocket to a subscription's connections
	 * @param {WebSocket} ws
	 * @param {string} channel
	 * @param {string} subId
	 * @returns {{type: string, channel: string, subId: string, numConnections: number}}
	 */
	subscribeChannel(ws, channel, subId) {
		let ack = {type: 'ack', subId: subId, channel: channel};
		if (ws && channel && subId) {
			const channelMap = this.getChannelMap(channel) || new Map();
			if (channelMap.has(subId)) {
				const subConns = channelMap.get(subId);
				const idx = subConns.indexOf(ws);
				if (idx === -1) {
					subConns.push(ws);
					channelMap.set(subId, subConns);
				}
			} else {
				channelMap.set(subId, [ws]);
			}
			this.setChannelMap(channel, channelMap);
			ack.numConnections = this.getChannelSubConnections(channel, subId).length;
		}
		return ack;
	}

	/**
	 * Provided a channel, will loop through all the subscriptions and if the provided
	 * websocket is in the array of subscription connections, will remove the provided
	 * websocket. If a subId is provided, will only cleanup that subscription's connections
	 * @param {WebSocket} ws
	 * @param {string} channel
	 * @param {string} [subId]
	 * @returns {{type: string, subId: string, channel: string, removedConnectionCount: number, subscriptionsDeleted: number, channelsDeleted: number}}
	 */
	unsubscribeChannel(ws, channel, subId) {
		const opInfo = {type: 'ack', subId: subId, channel: channel};
		if (ws && channel) {
			const channelMap = this.getChannelMap(channel);
			let updatedSubConns = [];
			if (channelMap && subId) {
				const startSubConnsLen = this.getChannelSubConnections(channel, subId).length;
				updatedSubConns = this._removeSubWebSocket(ws, channel, subId);
				opInfo.removedConnectionCount = startSubConnsLen - updatedSubConns.length;
			} else if (channelMap && !subId) {
				let removedCount = 0;
				[...channelMap.keys()].forEach((chanSubId) => {
					const startSubConnsLen = this.getChannelSubConnections(channel, subId).length;
					const subConns = this._removeSubWebSocket(ws, channel, chanSubId);
					updatedSubConns = [...updatedSubConns, ...subConns];
					const removedThisRun = startSubConnsLen - updatedSubConns.length;
					removedCount = removedCount + removedThisRun;
				});
				opInfo.removedConnectionCount = removedCount;
			}
			const emptySubsRemoved = this._cleanupEmptySubs();
			opInfo.subscriptionsDeleted = emptySubsRemoved.subsDeleted;
			opInfo.channelsDeleted = emptySubsRemoved.channelsDeleted;
		}
		return opInfo;
	}

	/**
	 * Removes a WebSocket from the provided channel and subscription
	 * @param {WebSocket} ws
	 * @param {string} channel
	 * @param {string} subId
	 * @returns {WebSocket[]}
	 */
	_removeSubWebSocket(ws, channel, subId) {
		const removedCount = 0;
		if (ws && channel && subId) {
			const subConns = this.getChannelSubConnections(channel, subId);
			const idx = subConns.indexOf(ws);
			if (idx > -1) {
				subConns.splice(idx, 1);
			}
			return subConns;
		}
		return [];
	}

	/**
	 * Removes any empty subscriptions and/or channels
	 * @returns {{subscriptionsDeleted: number, channelsDeleted: number}}
	 */
	_cleanupEmptySubs() {
		const channelMaps = this.channelMaps;
		let subDelCount = 0;
		let channelDelCount = 0;
		Object.keys(channelMaps).forEach((channel) => {
			const channelMap = this.getChannelMap(channel);
			[...channelMap.keys()].forEach((subId) => {
				if (!channelMap.get(subId).length) {
					channelMap.delete(subId);
					subDelCount++;
				}
			});
			if (!channelMap.size) {
				delete this.channelMaps[channel];
				channelDelCount++;
			} else {
				this.setChannelMap(channel, channelMap);
			}
		});
		return {subscriptionsDeleted: subDelCount, channelsDeleted: channelDelCount};
	}

	/**
	 * Will provide the connection information for a specific channel or all channels.
	 * If there is no `channel` property in the msg, then it will return connection info
	 * for all channels.
	 * @param {string} channel?
	 * @returns {type: string, {[<key: string>], {subId: string, numConnections: number}[]}}
	 */
	getInfoDetail(channel) {
		let payload = this.getInfo(channel);
		payload.uniqUserNames = Array.from(this.userMap.keys());
		payload.channelInfo.channels = {};
		if (channel) {
			payload.channelInfo.channels[channel] = this._getChannelInfo(channel);
		} else {
			const channels = Object.keys(this.channelMaps);
			channels.forEach((channel) => {
				payload.channelInfo.channels[channel] = this._getChannelInfo(channel);
			});
		}
		return payload;
	}

	/**
	 * Will provide the connection information for a specific channel or all channels.
	 * If there is no `channel` property in the msg, then it will return connection info
	 * for all channels.
	 * @returns {type: string, {[<key: string>], {subId: string, numConnections: number}[]}}
	 */
	getInfo() {
		let payload = {
			channelInfo: {}
		};
		payload.uniqUserNameCount = this.userMap.size;
		const channels = Object.keys(this.channelMaps);
		payload.channelInfo.totalConnections = this.getAllConnections().length;
		payload.channelInfo.totalChannels = channels ? channels.length : 0;
		let subCount = 0;
		channels.forEach((channel) => {
			const channelMap = this.channelMaps[channel];
			subCount = subCount + channelMap.size;
		});
		payload.channelInfo.totalSubscriptions = subCount;
		return payload
	}

	/**
	 * provided a channel will return an array of subscription names and the number
	 * of connections for those subscriptions
	 * @param {string} channel
	 */
	_getChannelInfo(channel) {
		const returnVal = [];
		if (channel) {
			const channelMap = this.getChannelMap(channel);
			if (channelMap) {
				[...channelMap.keys()].forEach((subId) => {
					returnVal.push({
						subId: subId,
						numConnections: channelMap.get(subId).length
					});
				});
			}
		}
		return returnVal;
	}

	/**
	 * Setup a user in the userMap to support sending notifications
	 * to a user
	 * @param {string|Object} user
	 * @param {WebSocket} ws
	 */
	setupUser(user, ws) {
		if (typeof user === 'string') {
			// Assume this would be a user id or email address
			if (!this.userMap.has(user)) {
				this.userMap.set(user, [ws]);
			}else{
				const userSockets = this.userMap.get(user);
				this.userMap.set(user, [...userSockets, ws]);
			}
		}else if (typeof user === 'object' && !Array.isArray(user)) {
			// Assume this would be a user object
			if (this.includeUserProps && this.includeUserProps.length) {
				this.includeUserProps.forEach((propName) => {
					const userProp = user[propName];
					if (!this.userMap.has(userProp)) {
						this.userMap.set(userProp, [ws]);
					}else{
						const userSockets = this.userMap.get(userProp);
						this.userMap.set(userProp, [...userSockets, ws]);
					}
				});
			}else{
				throw new Error('You must provide includeUserProps to support sending notifications to specific users');
			}
		}else {
			throw new Error('Unsupported User type');
		}
	}

	/**
	 * Get a user's connections
	 * @param {string} userTag
	 * @returns {WebSocket[]}
	 */
	getUserConnections(userTag) {
		let userConns = [];
		if (userTag) {
			userConns = this.userMap.get(userTag) || [];
		}
		return userConns;
	}

	/**
	 * Check if a user is online
	 * @param {string} userTag
	 * @returns {boolean}
	 */
	isUserOnline(userTag) {
		if (userTag) {
			return !!this.getUserConnections(userTag).length;
		}
		return false;
	}
}

module.exports = ChannelManager;
