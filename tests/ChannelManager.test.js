const ChannelManager = require('../ChannelManager');

let channelMgr;
let mockWs = {
	id: 'abc123',
	send: jest.fn()
}

beforeEach(() => {
	channelMgr = new ChannelManager();
});

test('it should update the channel maps object', () => {
	channelMgr.setChannelMap('test');
	expect(channelMgr.channelMaps.test).toBeTruthy();
});

test('it should retrieve a channel map', () => {
	channelMgr.setChannelMap('test');
	expect(channelMgr.getChannelMap('test')).toBeTruthy();
});

test('it should return an acknowledgement message when a subscription is created', () => {
	let ack = channelMgr.subscribeChannel(mockWs, 'test', 'test123');
	expect(ack).toBeTruthy();
	expect(ack.type).toEqual('ack');
	expect(channelMgr.getChannelMap('test')).toBeTruthy();
	expect(channelMgr.getChannelSubConnections('test', 'test123').length).toEqual(1);
	expect(channelMgr.getChannelConnections('test').length).toEqual(1);
	expect(channelMgr.getAllConnections().length).toEqual(1);
});

test('it should remove connections when unsubscribed', () => {
	const removeWsSpy = jest.spyOn(channelMgr, '_removeSubWebSocket');
	const cleanupSpy = jest.spyOn(channelMgr, '_cleanupEmptySubs');
	let ack = channelMgr.subscribeChannel(mockWs, 'test', 'test123');
	expect(channelMgr.getChannelConnections('test').length).toEqual(1);
	let unAck = channelMgr.unsubscribeChannel(mockWs, 'test', 'test123');
	expect(channelMgr.getChannelConnections('test').length).toEqual(0);
	expect(removeWsSpy).toHaveBeenCalled();
	expect(cleanupSpy).toHaveBeenCalled();
	expect(channelMgr.channelMaps.test).toBeFalsy();
});
