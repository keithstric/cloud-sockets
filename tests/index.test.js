const cloudSockets = require('../index');
const rewire = require('rewire');
const ChannelManager = require('../ChannelManager');
const EventEmitter = require('events').EventEmitter

let mockWs = {
	id: '123abc',
	send: jest.fn()
};
let msg;
let app;
let connMap;
let channelManager;

beforeEach(() => {
	app = rewire('../index.js');
	channelManager = new ChannelManager();
	app.__set__('channelMgr', channelManager);
	msg = {
		type: 'announce',
		channel: 'foo',
		subId: 'bar'
	};
	connMap = app.__get__('connectionsMap');
});

const middleware = function middleWare() {
	return cloudSockets({}, {});
};

test('middleware is instantiated', () => {
	expect(middleware).toBeTruthy();
	expect(typeof middleware).toEqual('function');
});

test('it should create an event listener when subscribed', () => {
	const onSub = app.__get__('onSubscribe');
	const createEvt = jest.fn();
	app.__set__('createEventListener', createEvt);
	msg.type = 'subscribe';
	onSub(mockWs, msg);
	expect(connMap).toBeTruthy();
	expect(connMap.size).toEqual(1);
	expect(connMap.get(mockWs).foo).toBeTruthy();
	expect(connMap.get(mockWs).foo).toEqual(['bar']);
	expect(createEvt).toHaveBeenCalled();
});

test('it should cleanup when unsubscribed', () => {
	const onSub = app.__get__('onSubscribe');
	const onUnSub = app.__get__('onUnsubscribe');
	msg.type = 'subscribe';
	onSub(mockWs, msg);
	expect(connMap).toBeTruthy();

	const getChannelConnsMock = jest.spyOn(channelManager, 'getChannelConnections').mockImplementation();
	msg.type = 'unsubscribe';
	onUnSub(mockWs, msg);
	expect(connMap.get(mockWs).foo.length).toEqual(0);
	expect(getChannelConnsMock).toHaveBeenCalled();
});

test('it should create an event listener', () => {
	app.__set__('socketEmitter', new EventEmitter());
	const emitter = app.__get__('socketEmitter');
	const createEvtListener = app.__get__('createEventListener');
	createEvtListener('foo');
	expect(emitter.listenerCount('foo')).toEqual(1);
});

test('it should call the eventHandler upon receiving an event', () => {
	app.__set__('socketEmitter', new EventEmitter());
	const emitter = app.__get__('socketEmitter');
	const createEventListener = app.__get__('createEventListener');
	const mockEventHandler = jest.fn();
	app.__set__('eventHandler', mockEventHandler);
	createEventListener('foo');
	const hasListener = emitter.emit('foo', 'foo', 'bar', 'announce', 'Event Emitter Test');
	expect(hasListener).toBe(true);
	expect(mockEventHandler).toHaveBeenCalled();
});
