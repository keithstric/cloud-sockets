# cloud-sockets Google Cloud PubSub example

This is an example using express and cloud-sockets with a PubSub provider. You can find some example messages in the `example-messages.json` file. This configuration would be used to scale your application. By using a PubSub provider it enables the PubSub to handle delivery of messages for an application which may have multiple instances running and clients aren't connected to the same server instances.

## Running

Since this is using Google Cloud PubSub, the Google Cloud SDK is required along with a service account, etc. which is beyond the scope of this example. So, I just included the implementation details and not a fully functioning example. It is a pure assumption that other PubSub providers would use similar information and setup. If something is required for different PubSub providers, please open an [issue](https://github.com/keithstric/cloud-sockets/issues) and I will implement it.

## Pertinent Options

The following options are provided to enable this scenario:

### ws Options

```js
{
  server: global.server, 
  port: 8080
}
```

### cloud-sockets Options

```js
{
	pubsubListener: pubSubFunctions.listenForPubSubMessages,
	pubsubPublisher: pubSubFunctions.publishPubSubMessages,
	pubsubTopicName: 'some-topic-name',
	pubSubSubscriptionName: 'api-service',
	pubsubMessageTypes: ['announceEvent']
}
```

## Implementation info

In the cloud-sockets options for `pubsubListener` and `pubsubPublisher` these are references to the pertinent functions, we don't actually call these functions from within the options. The `pubsubTopicName` is the topic defined in your service provider's pubsub configuration. The `pubSubSubscriptionName` is the subscription name defined in your service provider's pubsub configuration. Finally, the `pubsubMessageTypes` are the message types which will utilize the `pubsubPublisher` to send messages to PubSub.
