'use strict';
const express = require('express');
const session = require('express-session');
const uuid = require('uuid');
const http = require('http');
// Define your basic express setup
const app = express();
global.server = http.createServer(app);

// Define your middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// We must use the same instance of the session parser
const sessionParser = session({
	saveUninitialized: false,
	secret: '$ecr3t',
	resave: false
});
// Setup static site and sessionParser middleware
app.use(express.static('public'));
app.use(sessionParser);

// Setup our cloud-sockets middleware
// ws configuration
const wsConfig = {
	clientTracking: false,
	noServer: true
};
/**
 * @property {express-session} sessionParser - The express-session object
 * @property {boolean} setupHttpUser - Set to true to enable cloud-sockets notifications
 * @property {string} sessionUserPropertyName - The property name inside request.session that will contain the user
 * @property {string[]} includeUserProps - The user object properties to use for user lookups (i.e. @username)
 */
const csOptions = {
	sessionParser: sessionParser, // The express-session definition
	setupHttpUser: true, // Enables user setup inside cloud-sockets
	sessionUserPropertyName: 'user', // Property name in req.session that contains the user object/string
	includeUserProps: ['shortName'] // User can be found by this property value
};
// Define the cloud-sockets middleware after all your other middleware
const cloudSockets = require('../../index');
app.use(cloudSockets.socketServer(wsConfig, csOptions));
server.on('upgrade', cloudSockets.handleHttpServerUpgrade);

// Setup your route handling
// login route
app.post('/login', (req, res, next) => {
	const uuidStr = uuid.v4();
	if (req.body && req.body.email) {
		console.log(`creating session for ${req.body.email}`);
		const atIdx = req.body.email.indexOf('@');
		const shortName = req.body.email.substring(0, atIdx);
		req.session.user = {
			id: uuidStr,
			email: req.body.email,
			shortName: shortName
		};
		res.send({result: 'OK', message: `Session Updated with user`, user: `${JSON.stringify(req.session.user)}`});
	}else{
		res.status(500).send({result: 'ERROR', message: 'No body!'});
	}
});
// logout route
app.delete('/logout', (req, res) => {
	console.log(`destroying session for ${req.session ? req.session.user.email : 'unknown'}`);
	cloudSockets.handleLogout(req.session.user, 'id');
	req.session.destroy(() => {
		res.send({result: 'OK', message: 'Session Destroyed'});
	});
});

// Startup the express server
server.listen(3000, () => {
	console.log('express listening on port 3000');
});
