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
