# cloud-sockets Custom Message Handler example

This is an example of using express and cloud-sockets with a custom message handler. You can find some example messages in the `example-messages.json` file.

## Running

To run this example, run `npm install` from within this directory and then `npm start`. Use your favorite websocket client to connect and send messages. It is recommended to use 2 instances of your websocket client in order to receive messages sent.

## Pertinent Options

The following options are provided to enable this scenario:

### cloud-sockets Options

The key `customMessageType` will be the `type` property defined in messages.
```js
{
	customMsgHandlers: {'customMessageType': customHandlers.customMsgHandler}
}
```

## Implementation info

We have included the actual message handler in the `cloud-sockets-impl.js` file. We provide this function (we don't call the function, just reference it) in the cloud-sockets options.
