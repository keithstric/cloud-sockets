/**
 * Sends a google cloud pubsub message
 * @param {string} topic 
 * @param {any} payload 
 */
async function publishPubSubMessage(topic, payload) {
	const {PubSub} = require('@google-cloud/pubsub');
	const pubsub = new PubSub();
	if (typeof payload !== 'string') {
		payload = JSON.stringify(payload);
	}
	const dataBuffer = Buffer.from(payload);
	const msgId = await pubsub.topic(topic).publish(dataBuffer);
	// console.log(`Published message with id: ${msgId}`);
	return msgId;
}
/**
 * Listens to the Google Cloud PubSub subscription (pubsubSubscriptionName) for
 * incoming messages. Will then find the appropriate channelsMap
 * and send the messages to all WebSocket connections in the channel
 * map that matches the subId in the message
 * @param {string} subscriptionName - The subscription name to listen to
 */
function listenForPubSubMessages(subscriptionName) {
	const {PubSub} = require('@google-cloud/pubsub');
	const pubsub = new PubSub();
	const subscription = pubsub.subscription(subscriptionName);
	return subscription;
}

module.exports.publishPubSubMessages = publishPubSubMessage;
module.exports.listenForPubSubMessages = listenForPubSubMessages;
