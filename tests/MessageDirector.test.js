const MessageDirector = require('../MessageDirector');

const msgDir = new MessageDirector();
const msg = {
	type: 'announce',
	channel: 'foo',
	subId: 'bar'
};

test('It should instantiate a Awaiting Acknowledgement map', () =>{
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
