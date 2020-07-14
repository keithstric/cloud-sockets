const MessageDirector = require('../MessageDirector');
const expect = require('expect');

let msgDir;
const msg = {
	type: 'announce',
	channel: 'foo',
	subId: 'bar'
};
let mockWs = {
	id: 'abc123',
	send: jest.fn()
}

beforeEach(() => {
	const options = {
		ackMessageTypes: ['announce'],
		customMsgHandlers: {},
		msgResendDelay: 60000
	};
	msgDir = new MessageDirector(options);
});

test('it should instantiate an Awaiting Acknowledgement map', () =>{
	expect(msgDir.awaitingAck).toBeTruthy();
	expect(msgDir.channelMgr).toBeTruthy();
});

test('formatMessage should add an id and sentDateTime to message', () => {
	let message = msgDir.formatMessage(msg);
	expect(typeof message).toEqual('string');
	if (message && typeof message === 'string') {
		message = JSON.parse(message);
	}
	expect(message.id).toBeTruthy();
	expect(message.sentDateTime).toBeTruthy();
});

test('it should instantiate initial values', () => {
	expect(msgDir.acknowledgementTypes).toBeTruthy();
	expect(msgDir.customMsgHandlers).toBeTruthy();
	expect(msgDir.awaitingRetryDelay).toBeTruthy();
	expect(msgDir.channelMgr).toBeTruthy();
});

test('it should call the proper method based on a message type', () => {
	// Mock sendMessage function to prevent error
	const mockSend = jest.spyOn(msgDir, 'sendMessage').mockImplementation()

	const subSpy = jest.spyOn(msgDir, 'subscribe');
	msg.type = 'subscribe';
	msgDir.handleMsg({}, JSON.stringify(msg));
	expect(subSpy).toHaveBeenCalled();
	expect(mockSend).toHaveBeenCalled();
	
	const ackSpy = jest.spyOn(msgDir, '_removeAwaitingAck');
	msg.type = 'ack';
	msgDir.handleMsg({}, JSON.stringify(msg));
	expect(ackSpy).toHaveBeenCalled();
	expect(mockSend).toHaveBeenCalled();
	
	const annSpy = jest.spyOn(msgDir, 'announce');
	msg.type = 'announce';
	msgDir.handleMsg({}, JSON.stringify(msg));
	expect(annSpy).toHaveBeenCalled();
	expect(mockSend).toHaveBeenCalled();
	
	const unsubSpy = jest.spyOn(msgDir, 'unsubscribe');
	msg.type = 'unsubscribe';
	msgDir.handleMsg({}, JSON.stringify(msg));
	expect(unsubSpy).toHaveBeenCalled();
	expect(mockSend).toHaveBeenCalled();

	const notifySpy = jest.spyOn(msgDir, 'notifyUser');
	msg.type = 'notification';
	msgDir.handleMsg({}, JSON.stringify(msg));
	expect(notifySpy).toHaveBeenCalled();

	msg.type = 'foo';
	const errorMsg = {type: 'error', value: `Message type "${msg.type}" not supported`, msg: msg};
	msgDir.handleMsg(mockWs, JSON.stringify(msg));
	expect(mockSend).toHaveBeenCalledWith(mockWs, errorMsg);

	msgDir.customMsgHandlers = {'foo': jest.fn()}
	msg.type = 'foo';
	const customSpy = jest.spyOn(msgDir.customMsgHandlers, 'foo');
	msgDir.handleMsg(mockWs, JSON.stringify(msg));
	expect(customSpy).toHaveBeenCalled();

	msgDir.pubsubPublisher = jest.fn;
	msgDir.pubsubTopic = 'topic-name';
	msgDir.pubsubMessageTypes = ['PubSub'];
	msg.type = 'PubSub';
	const publisherSpy = jest.spyOn(msgDir, 'pubsubPublisher');
	msgDir.handleMsg(mockWs, JSON.stringify(msg));
	expect(publisherSpy).toHaveBeenCalled();
});

test('it should create a uuid', () => {
	const uuid = msgDir._uuidv4();
	expect(uuid).toBeTruthy();
});

test('it should add/remove messages to the awaiting acknowledgement que', () => {
	const mockWs = {
		id: '123abc',
		send: jest.fn()
	};
	const addAwaitSpy = jest.spyOn(msgDir, '_addAwaitingAck');
	msg.type = 'announce';
	msg.id = 'abc123';
	msgDir.sendMessage(mockWs, msg);
	expect(addAwaitSpy).toHaveBeenCalled();
	expect(msgDir.awaitingAck.size).toEqual(1);

	const removeAwaitSpy = jest.spyOn(msgDir, '_removeAwaitingAck');
	msg.type = 'ack';
	msg.id = 'abc123';
	msgDir.handleMsg(mockWs, JSON.stringify(msg));
	expect(removeAwaitSpy).toHaveBeenCalled();
	expect(msgDir.awaitingAck.size).toEqual(0);
});

test('it should attempt to use the pubsub publisher (if provided) to notify an offline user', () => {
	let pubSubOptions = {
		ackMessageTypes: ['announce'],
		customMsgHandlers: {},
		msgResendDelay: 60000,
		pubsubPublisher: jest.fn
	};
	msgDir = new MessageDirector(pubSubOptions);
	const pubsubSpy = jest.spyOn(msgDir, 'pubsubPublisher');
	const notifySpy = jest.spyOn(msgDir, 'notifyUser');
	msg.type = 'notification';
	msgDir.handleMsg(mockWs, JSON.stringify(msg));
	expect(notifySpy).toHaveBeenCalled();
	expect(pubsubSpy).toHaveBeenCalled();
});

test('it should attempt to notify a user', () => {
	let options = {
		ackMessageTypes: [],
		setupHttpUser: true,
		includeUserProps: ['email'],
		pubsubPublisher: jest.fn,
		pubSubtopic: 'topic-name',
		pubsubMessageTypes: ['PubSub']
	}
	msgDir = new MessageDirector(options);
	const getUserConnsSpy = jest.spyOn(msgDir.channelMgr, 'getUserConnections')
		.mockImplementation(() => [Object.assign({}, mockWs)]);
	const sendSpy = jest.spyOn(msgDir, 'sendMessage');
	msgDir.notifyUser(mockWs, msg, 'joe@knowhere.com');
	expect(getUserConnsSpy).toHaveBeenCalled();
	expect(sendSpy).toHaveBeenCalled();
});

test('it should return information about itself', () => {
	const info = msgDir.getInfo();
	expect(info).toBeTruthy();
	expect(info.messageInfo).toBeTruthy();
	msgDir._addAwaitingAck(mockWs, msg);
	const infoDetail = msgDir.getInfoDetail();
	expect(infoDetail.messageInfo.awaitingMessages).toBeTruthy();
});
