# cloud-sockets Authentication example

This is an example of using express and express-session for authentication. The socket server will not accept unauthenticated connections. You can find some example messages in the `example-messages.json` file.

## Running

To run this example, run `npm install` from within this directory and then `npm start`. Open `http://localhost:3000` in your browser.

## Pertinent Options

The following options are provided to enable this scenario:

### ws Options

```js
{
	clientTracking: false,
	noServer: true
}
```

### cloud-sockets Options

```js
{
	sessionParser: sessionParser, // The express-session definition
	setupHttpUser: true, // Enables user setup inside cloud-sockets
	sessionUserPropertyName: 'user', // Property name in req.session that contains the user object/string
	includeUserProps: ['shortName'] // User can be found by this property value
}
```

## Implementation Info

If `setupHttpUser` is `true` then an entry will be created in the `ChannelManager.userMap` Map. This allows messages with a `userTag` property to be sent to the provided user. For example. If a user is logged in that has the following user object in `req.session.user`:

```json
{
    "id": "abc123",
    "email": "the.collector@knowhere.com",
    "shortName": "the.collector"
}
```

Using the option for `includeUserProps` we will add an entry to the `userMap` with a key of "the.collector" and then any message with a `userTag` of "the.collector" will be sent directly to that user. If for whatever reason that user isn't in the `userMap` a message declaring that user is not online will be sent to the original sender.
