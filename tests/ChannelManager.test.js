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

test('it should update the user map object', () => {
	channelMgr.setupUser('abc123', mockWs);
	expect(channelMgr.userMap.size).toEqual(1);
	expect(channelMgr.userMap.get('abc123')).toBeTruthy();
	channelMgr.includeUserProps = ['shortname'];
	channelMgr.setupUser({shortname: 'foo'}, mockWs);
	expect(channelMgr.userMap.size).toEqual(2);
	expect(channelMgr.userMap.get('foo')).toBeTruthy();
});

test('it should throw an error if user is not a string or object', () =>  {
	expect(() => {channelMgr.setupUser(['foo'], mockWs);}).toThrow();
});

test('it should return a users connections', () => {
	channelMgr.setupUser('abc123', mockWs);
	expect(channelMgr.getUserConnections('abc123')).toBeTruthy();
	expect(channelMgr.getUserConnections('abc123').length).toBeTruthy();
});

test('it should be able to determine if someone is online', () => {
	expect(channelMgr.isUserOnline('abc123')).toBe(false);
	channelMgr.setupUser('abc123', mockWs);
	expect(channelMgr.isUserOnline('abc123')).toBe(true);
	expect(channelMgr.isUserOnline()).toBe(false);
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

test('it should insert connection into an existing subscription', () => {
	channelMgr.subscribeChannel(mockWs, 'test', 'test123');
	channelMgr.subscribeChannel(Object.assign({}, mockWs), 'test', 'test123');
	expect(channelMgr.getChannelMap('test')).toBeTruthy();
	expect(channelMgr.getChannelSubConnections('test', 'test123').length).toEqual(2);
	expect(channelMgr.getChannelConnections('test').length).toEqual(2);
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

test('it should remove connections when unsubscribed to just a channel', () => {
	let ack = channelMgr.subscribeChannel(mockWs, 'test', 'test123');
	expect(channelMgr.getChannelConnections('test').length).toEqual(1);
	let unAck = channelMgr.unsubscribeChannel(mockWs, 'test');
	expect(channelMgr.channelMaps.test).toBeFalsy();
});

test('it should return information about itself', () => {
	let ack = channelMgr.subscribeChannel(mockWs, 'test', 'test123');
	const info = channelMgr.getInfo();
	expect(info).toBeTruthy();
	expect(info.channelInfo).toBeTruthy();
	expect(info.channelInfo.totalConnections).toBe(1);
	expect(info.channelInfo.totalChannels).toBe(1);
	expect(info.channelInfo.totalSubscriptions).toBe(1);
	const detailInfo = channelMgr.getInfoDetail();
	expect(detailInfo).toBeTruthy();
	expect(detailInfo.channelInfo).toBeTruthy();
	expect(detailInfo.channelInfo.channels).toBeTruthy();
	expect(detailInfo.channelInfo.channels['test']).toBeTruthy();
	const detailInfoSpecific = channelMgr.getInfoDetail('test');
	expect(detailInfoSpecific).toBeTruthy();
	expect(detailInfoSpecific.channelInfo).toBeTruthy();
	expect(detailInfoSpecific.channelInfo.channels).toBeTruthy();
	expect(detailInfoSpecific.channelInfo.channels['test']).toBeTruthy();
});
