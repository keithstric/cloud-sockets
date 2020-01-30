/**
 * A custom message handler
 * @param {WebSocket} ws 
 * @param {Message} msg 
 * @param {MessageDirector} msgDirector 
 */
function customMsgHandler(ws, msg, msgDirector) {
	let msg = message;
	if (typeof message === 'string') {
		console.log('parsing message')
		msg = JSON.parse(message);
	}
	msg.type = 'announce';
	msgDirector.handleMsg(ws, JSON.stringify(msg));
}

module.exports.customMsgHandler = customMsgHandler;
