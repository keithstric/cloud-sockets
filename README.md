# cloud-sockets

A websocket boilerplate using ws for nodejs

## Installation

```cli
npm install --save cloud-sockets
```

## Usage

## Architecture

The basis behind cloud-sockets is to provide a robust WebSocket Server implementation that allows customization and message acknowledgement support. There are a few terms that you should be aware of and the theory around those terms which will be used in this documentation.

* Channel - This is an organization type where a channel is a category with sub-categories. A channel will have an event listener created to handle messages spawning from an event. It also provides a means for messages to find their target(s).
* Subscription - This would be a sub-category of a channel. It would probably be an id of some kind. This is an array of `WebSocket` connections.
* Message - This is an object that will be passed between WebSocket Server and Client. It must follow the interface defined for a message for all of this to function properly.
* Acknowledgement - Some message types require acknowledgement from the client that it was received. Messages that require acknowledgement will be resent for a certain amount of time until an acknowledgement is received

### WebSocket Middleware

This contains the actual middleware function.

#### Connection Map

This map provides a way to organize all the server's connections and what channels and subscriptions a certain connection is subscribed to. It's main purpose is for cleanup efforts when a connection is lost. The strucure of this map is `Map<WebSocket, {<channel: string,>, <subId: string>[]}>`

#### Event Handler

The event handler is named `global.socketEmitter` and is an `EventEmitter` from the nodejs `events` module. This is your entry point to sending messages from within your application. When a `channel` is subscribed to an event listener for that `channel` is created. Likewise when there are no subscriptions to a `channel` the event listener is removed.

### MessageDirector

This class is responsible for managing the flow of messages to and from the server. It is also responsible for maintaining the messages awaiting an acknowledgement. The acknowledgements are stored in a `Map<WebSocket, Message[]>` structure. The decision to use a `Map` was because a single websocket could be sent multiple messages from multiple channels.

### Acknowledgements

Some messages you may want to keep retrying until we know a client has received it. This is where acknowledgements come in. If a message type should be acknowledged, we will store that message in the awaiting acknowledgement que which is a `Map<WebSocket, Message[]>`. As the message is sent to a WebSocket it will be stored in the que with an `interval` attached to keep retrying until we receive an acknowledgement back from the client it was sent to.

### Message structure

A message from the client needs to follow a certain structure in order to be handled properly. If it doesn't follow this structure it'll just be returned to sender. The structure follows the following interface.

#### Message Properties

* type - This is required to determine how the message should be handled. There are 6 different types
   ** subscribe - Subscribes to a subscription. Requires the `channel` and `subId` properties to be defined
   ** unsubscribe - Unsubscribes from a subscription. If no `channel` or `subId` is provided will unsubscribe the user from all subscriptions. If a `channel` is provided with no `subId` will unsubscribe from all subscriptions in the provided channel. If a `channel` and `subId` are provided will unsubscribe from just that subscription
   ** announce - Sends a message to different set of connections based on the properties provided. If no `channel` is provided will send to ALL connections. If a `channel` is provided with no `subId` will send to all connections for that `channel`. If a `channel` and `subId` is provided will send to all connections that are a part of that subscription.
   ** ack - An acknowledgement from the client. Must include the `id` from the original message
   ** getInfo - Provides basic information about the server, connections, channels, subscriptions and messages awaiting acknowledgement
   ** getInfoDetail - Provides detailed information about the connections, channels, subscriptions and messages awaiting acknowledgement
   ** user - Provides a means to setup channels and subscriptions for a specific user. This allows messages to be sent to a specific user
* channel - This defines a category of subscriptions
* subId - This provides a list of connections for a specific id or subscription
* payload - This can be any type of data

### ChannelManager

This class is responsible for managing the channel subscriptions.

#### Channel Maps

The channel map is used to organize which connections are interested in which overall channels and specific subscriptions. The channel map is an `object` whose key is a `channel`. The value of the `object` is a `Map<string, WebSocket[]>`. The map's key is a subscription id and it's value is an array of `WebSocket` connections. This structure allows us to organize connections in a way that is easily locatable.

An example use case for this structure might be: You have a lot of users which may be viewing different parts of the application at the same time and you want to provide real time updates. Lets take a todo app where people can share lists of tasks. You would have a specific list (`channel`) that multiple people might be looking at the same time. When someone adds or changes an item in that list everyone else's display should just update without the need for a refresh. So the list would be the `channel` and a list item would be a `subscription`.

## WebSocket Server Configuration


## cloud-sockets options

