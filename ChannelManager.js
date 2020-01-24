/**
 * This class manages the channel subscriptions which is at the heart
 * of the cloud-sockets project. It is responsible for maintaining an
 * object of channels whose value is a map with a key of a subscription id
 * and a value that is an array of WebSocket.
 * @class {ChannelManager}
 */
class ChannelManager {

	constructor() {
		this.channelMaps = {};
	}
	/**
	 * Get a channel map
	 * @param {string} channel 
	 * @returns {Map<string, WebSocket[]}
	 */
	getChannelMap(channel) {
		return this.channelMaps[channel];
	}
	/**
	 * Set a channel map
	 * @param {string} channel 
	 * @param {Map<string, WebSocket[]} channelMap 
	 * @returns {Map<string, WebSocket[]}
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
		})
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
			}else{
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
	 * @param {string} subId?
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
			}else if (channelMap && !subId) {
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
				delete this.channelMaps[channel]
				channelDelCount++;
			}else{
				this.setChannelMap(channel, channelMap);
			}
		});
		return {subsDeleted: subDelCount, channelsDeleted: channelDelCount};
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
		payload.channelInfo.channels = {};
		if (channel) {
			payload.channelInfo.channels[channel] = this._getChannelInfo(channel);
		}else{
			const channels = Object.keys(this.channelMaps);
			channels.forEach((channel) => {
				payload.channelInfo.channels[channel] = this._getChannelInfo(channel);
			});
		}
		return payload;
	}

	getInfo(channel) {
		let payload = {
			channelInfo: {}
		};
		const channels = Object.keys(this.channelMaps);
		payload.channelInfo.totalConnections = this.getAllConnections().length;
		payload.channelInfo.totalChannels = channels ? channels.length : 0;
		if (channel) {
			payload.channelInfo.channelConnectionCount = this.getChannelConnections(channel).length;
			payload.channelInfo.channelSubscriptions = this.getChannelMap(channel).size;
		}
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
			[...channelMap.keys()].forEach((subId) => {
				returnVal.push({
					subId: subId,
					numConnections: channelMap.get(subId).length
				});
			});
		}
		return returnVal;
	}
}

module.exports = ChannelManager;
