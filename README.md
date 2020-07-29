# cloud-sockets

A websocket implementation using [ws](https://www.npmjs.com/package/ws) for nodejs. This project provides the base infrastructure for a WebSocket project with the following features:

* Defined Message types
* Customizable Message types
* PubSub support for scaling
* Event Driven
* User notifications
* Message Acknowledgement Support

## Installation

```cli
npm install --save cloud-sockets
```

## Usage

Express middleware definition

**Example: basic usage**
```javascript
// WebSocket Server configuration
const wsConfig = {
	server: app,
	port: 8081
};
// cloud-sockets customization options
const csOptions = {
	ackMessageTypes: ['announce'],
	msgResendDelay: 60000,
	broadcastMessageTypes: ['broadcast']
};
// Middleware implementation
const cloudSockets = require('cloud-sockets');
app.use(cloudSockets.socketServer(wsConfig, csOptions));
/**
 * Every channel gets an event listener created upon creation. Emitting a properly formatted event will result in a WS message being sent
 * @param {string} Channel name - When a channel is subscribed to an event listener with the channel name will be created
 * @param {string} channel - The channel name (i.e. Todo List Name)
 * @param {string} subId,- The ID of a todo list item
 * @param {string} type - The message type
 * @param {any} payload - Your data goes here
 */
global.socketEmitter.emit('AddTodo', 'todoList1234', 'todo1234', 'announce', {
	subject: 'New todo',
	text: 'This is a new todo item description'
});
```

## Overview

The basis behind cloud-sockets is to provide a robust WebSocket Server implementation that allows customization, PubSub Usage and message acknowledgement support. There are a few terms that you should be aware of and the theory around those terms which will be used in this documentation.

* Channel - This is an organization type where a channel is a category with sub-categories. A channel will have an event listener created to handle messages spawning from an event. It also provides a means for messages to find their target(s).
* Subscription - This would be a sub-category of a channel. It would probably be an id of some kind. This is an array of `WebSocket` connections.
* Message - This is an object that will be passed between WebSocket Server, PubSub and Client. It must follow the interface defined for a message for all of this to function properly.
* Acknowledgement - Some message types may require acknowledgement from the client that it was received. Messages that require acknowledgement will be resent for a certain amount of time until an acknowledgement is received or the defined `abandonAfterRetriesCount` option has been reached

### WebSocket Middleware

#### Connection Map

This map provides a way to organize all the server's connections and what channels and subscriptions a certain connection is subscribed to. It's main purpose is for cleanup efforts when a connection is lost. The strucure of this map is `Map<WebSocket, {<channel: string,>, <subId: string>[]}>`

#### Event Handler

The event handler is named `global.socketEmitter` and is an `EventEmitter` from the nodejs `events` module. This is your entry point to sending messages from within your application. When a `channel` is subscribed to, an event listener for that `channel` is created. Likewise when there are no subscriptions/connections to a `channel` the event listener is removed. When emitting an event follow the below defined pattern:

```javascript
// This is your custom object or whatever. Do not include a full message with channel and subId.
const payload = {
  subject: 'Abc 123',
  text: 'Abc 123 Text'
}
global.socketEmitter.emit('<ChannelName>', '<ChannelName>', '<SubId>', payload);
```

### MessageDirector

This class is responsible for managing the flow of messages to and from the server. It is also responsible for maintaining the messages awaiting an acknowledgement. The acknowledgements are stored in a `Map<WebSocket, Message[]>` structure. The decision to use a `Map` was because a single websocket could be sent multiple messages from multiple channels.

#### Acknowledgements

Some messages you may want to keep retrying until we know a client has received it. This is where acknowledgements come in. If a message type should be acknowledged, we will store that message in the awaiting acknowledgement que which is a `Map<WebSocket, Message[]>`. As the message is sent to a WebSocket it will be stored in the que with an `interval` attached to keep retrying until we receive an acknowledgement back from the client it was sent to.

#### Message structure

A message from the client needs to follow a certain structure in order to be handled properly. If it doesn't follow this structure it'll just be returned to sender. The structure follows the following interface.

##### Message Properties

* `type` - This is required to determine how the message should be handled. There are 6 different default message types
    * `subscribe` - Subscribes to a subscription. Requires the `channel` and `subId` properties to be defined
    * `unsubscribe` - Unsubscribes from a subscription. If no `channel` or `subId` is provided will unsubscribe the user from all subscriptions. If a `channel` is provided with no `subId` will unsubscribe from all subscriptions in the provided channel. If a `channel` and `subId` are provided will unsubscribe from just that subscription
    * `announce` - Sends a message to connections based on the properties provided. If no `channel` is provided will send to ALL connections. If a `channel` is provided with no `subId` will send to all connections for that `channel`. If a `channel` and `subId` is provided will send to all connections that are a part of that subscription.
    * `ack` - An acknowledgement from the client or server. Must include the `id` from the original message
    * `getInfo` - Provides basic information about the server, connections, channels, subscriptions and messages awaiting acknowledgement
    * `getInfoDetail` - Provides detailed information about the connections, channels, subscriptions and messages awaiting acknowledgement
    * `notification` - Used for sending notifications to specific users. Only works if authentication is enabled
    * `broadcast` - Used for sending a message to all connections on the server
* `channel?` - This defines a category of subscriptions
* `subId?` - This defines an id for a subscription
* `payload?` - This can be any type of data
* `pubsubId?` - This is added to a message received via the pubsub
* `sendToSender?` - Set to true to send the message to the sender. Default behavior is to NOT send a message to the sender
* `id` - This is automatically added to every message sent by cloud-sockets
* `sentDateTime` - This is automatically added to every message sent by cloud-sockets

#### MessageDirector API

**announce(message: any, channel?: string, subId?: string)**

Send a message to a channel, subscription or everyone

* If no `subId` is provided, will send a message to all connections for the `channel`
* If no `channel` or `subId` will send a message to all connections that are subscribed to any channel

**formatMessage(message: any)**

Will add `id` and `sentDateTime` properties to the message, then stringify it and return the stringify results

**getInfo()**

Will send a message back to originating WebSocket containing information about messages awaiting acknowledgement

**getInfoDetail()**

Will return the same thing as getInfo but also an array of ids for messages awaiting acknowledgement

**handleMsg(ws: WebSocket, message: any)**

Route a message based on it's `type`, `channel` and `subId` properties.

**sendMessage(ws: WebSocket, message: any)**

Send a message to the provided Websocket. Will add an `id` and `sentDateTime` properties

**subscribe(ws: WebSocket, channel: string, subId: string)**

Subscribe the provided WebSocket to a channel subscription

**unsubscribe(ws: WebSocket, channel?: string, subId?: string)**

Unsubscribe from a channel subscription.

* If no `subId` is provided, will unsubscribe from all subscriptions inside a channel
* If no `channel` or `subId` is provided will unsubscribe from all channels

### ChannelManager

This class is responsible for managing the channel subscriptions and user identification.

#### Channel Maps

The channel map is used to organize which channels and subscriptions a connection is interested in. The channel map is an `object` whose key is a `channel`. The value of the `channel` is a `Map<string, WebSocket[]>`. The map's key is a subscription id (`subId`) and it's value is an array of `WebSocket` connections. This structure allows us to organize connections in a way that is easily locatable.

```javascript
// Channel Maps structure
const channelMaps = {
	channelName: { // this is actually a Map, not an object
		subscriptionId: [ws]
	}
}
```
An example use case for this structure might be: You have a lot of users which may be viewing different parts of an application at the same time and you want to provide real time updates to the lists and items. Lets take a todo app where people can share lists of tasks. You would have a specific list (`channel`) that multiple people might be viewing at the same time. When someone adds or changes an item in that list everyone else's display should just update without the need for a refresh. So the list would be the `channel` and a list item would be a `subscription`.

The user map is used to identify a specific user's connections. It is a `Map<string, WebSocket[]` whose key is a `string`. This key is derived from the user object and properties defined in the`includeUserProps` option. The value is a `WebSocket`. The main purpose is to support `@username` type lookups.

## WebSocket Server Configuration

The WebSocket server is [ws](https://www.npmjs.com/package/ws) behind the scenes. The configuration options available match those of the [ws WebSocket.Server class](https://github.com/websockets/ws/blob/HEAD/doc/ws.md#class-websocketserver) in that project.

## cloud-sockets options

The following options are available for customization of cloud-sockets.

* `abandonAfterRetriesCount` {number} - Default = 60. Number of times to retry sending a message which requires acknowledgement
* `ackMessageTypes` {string[]} - An array of message types which will require an acknowledgement from the client upon receipt to stop send retries
* `broadcastMessageTypes` {string[]} - An array of message types that should send a message to all connections
* `customMsgHandlers` {{string, function}} - An object whose key is a message type and value is a function. You may not define a custom handler for any of the default message types. The function will receive 3 arguments: The initiating WebSocket, the message and the instance of the MessageDirector.
* `includeUserProps` {string[]} - If setupHttpUser is true. Properties from the user object to include as identifiers for that user
* `msgResendDelay` {number} - Default = 60000. Number of milliseconds to wait before resending a message awaiting acknowledgement
* `pubsubListener` {function} - Listener function for your PubSub provider
* `pubsubMessageTypes` {string[]} - Array of message types that should be sent through the PubSub topic
* `pubsubPublisher` {function} - Function for publishing to your PubSub provider
* `pubsubSubscriptionName` {string} - The PubSub subscription name
* `pubsubTopicName` {string} - The PubSub topic name
* `sendAnnounceMsgstoSelf` {boolean} - Set to true to globally enable `announce` messages to be sent to the sender
* `setupHttpUser` {boolean} - Set to true to map http users who have a cloud-sockets connection
* `sessionParser` {any} - [express-session](https://github.com/expressjs/session)
* `sessionUserPropertyName` {string} - The property in the express request object that contains the user object/id.

## Custom Message Handlers

You can define custom message handlers in the cloud-sockets options. These allow you to add your own logic to certain message types. The function provided will be passed 3 arguments: The originating WebSocket, the message and the current instance of the MessageDirector. You can see an example in the [custom-handler examples](http://github.com/keithstric/cloud-sockets/tree/master/examples/custom-handler).

## How to contribute

### Did you find a bug?

* **Ensure the bug was not already reported** by searching the GitHub [issues](https://github.com/keithstric/cloud-sockets/issues)
* If you can't find a bug report, [open a new issue](https://github.com/keithstric/cloud-sockets/issues/new). Be sure to include a title and clear description with as much relevant information as possible. Code snippets or test cases demonstrating the problem are most welcome.

### Did you write a patch that fixes a bug or adds new features?

Just submit a Pull Request. Ensure the PR description clearly describes the problem and solution. Include the relevant issue number if applicable. Be sure to include unit tests for your change.
