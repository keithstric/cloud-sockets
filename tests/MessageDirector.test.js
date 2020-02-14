const MessageDirector = require('../MessageDirector');

let msgDir;
const msg = {
	type: 'announce',
	channel: 'foo',
	subId: 'bar'
};

beforeEach(() => {
	const options = {
		ackMessageTypes: ['announce'],
		customMsgHandlers: {},
		msgResendDelay: 60000
	}
	msgDir = new MessageDirector(options);
});

test('It should instantiate an Awaiting Acknowledgement map', () =>{
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
