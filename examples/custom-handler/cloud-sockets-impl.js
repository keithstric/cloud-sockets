/**
 * A custom message handler. The params that will be passed to this
 * function are documented below
 * @param {WebSocket} ws
 * @param {Message: string} message
 * @param {MessageDirector} msgDirector
 */
function customMsgHandler(ws, message, msgDirector) {
	console.log('Inside customMsgHandler', message);
	// convert the message into something usable
	let msg = message;
	if (typeof message === 'string') {
		msg = JSON.parse(message);
	}
	// We're just passing this along, but your custom logic would go here
	// which may/may not include sending another socket message
	msg.type = 'announce';
	msgDirector.handleMsg(ws, JSON.stringify(msg));
}

module.exports.customMsgHandler = customMsgHandler;
