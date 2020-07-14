# cloud-sockets Acknowledgement example

This is an example of using express and cloud-sockets with an acknowledgement required for messages with type `announce`. You can find some example messages in the `example-messages.json` file.

## Running

To run this example, run `npm install` from within this directory and then `npm start`. Use your favorite websocket client to connect and send messages. It is recommended to use 2 instances of your websocket client in order to receive messages sent.

To see the acknowledgement in progress follow these steps:

1. websocket client#1 - connect
2. websocket client#2 - connect
3. websocket client#2 - Send a `subscription` message
4. websocket client#1 - Send a `getInfoDetail` message. Take note of the `channelInfo` object. `totalConnections` should be 1. In the `messageInfo` object. `totalConnectionsAwaitingAck` should be 0.
5. websocket client#1 - Send an `announce` message to channel `test-channel`, subId `test-sub1`
6. websocket client#1 - Send a `getInfoDetail` message. Take note of the `messageInfo` object. `totalConnectionsAwaitingAck` should be 1.
7. websocket client#2 - Ensure `announce` message was received
8. websocket client#2 - Send an `ack` message with `id` equal to the `id` in the received `announce` message
9. websocket client#1 - Send a `getInfoDetail` message. Take note of the `messageInfo` object. `totalConnectionsAwaitingAck` should be 0.

## Pertinent Options

The following options are provided to enable this scenario:

### cloud-sockets Options

The key `customMessageType` will be the `type` property defined in messages.
```js
{
	ackMessageTypes: ['announce']
}
```
