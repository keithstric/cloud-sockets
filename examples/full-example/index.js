'use strict';
const express = require('express');
const http = require('http');

// Define your basic express setup
const app = express();
global.server = http.createServer(app);

// Define your middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Setup static site and sessionParser middleware
app.use(express.static('public/dist/angular-boilerplate'));

// Setup CRUD storage to a JSON file
const makeCrud = require('express-json-file-crud').makeCrud;
const todoCrud = makeCrud('todo', './storage');
// define the route to send a socket message and then perform CRUD operation.
// For demo purposes only. Not recommended for production applications, use a real DB.
app.use('/api/todo', sendSocketMessage, todoCrud);

// Define the cloud-sockets middleware after all your other middleware
const cloudSockets = require('../../index');
app.use(cloudSockets.socketServer(null, null));

/**
 * This function passes along CRUD operation messages to connected clients.
 * It runs before the CRUD operation actually happens which is questionable of course
 * but without modifying the module we're using for CRUD this was the only way
 * to pass messages. The best way to implement this is to do this after the CRUD
 * operation to ensure we're reporting absolute truth. Hopefully whomever reads this
 * can get the gist of how to implement cloud-sockets in their environment.
 *
 * This implementation is by no means a production implementation. While the pattern
 * may be relevant, it is not recommended. The recommended implementation would be
 * to add the event emitter within your backend's business logic.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function sendSocketMessage(req, res, next) {
	let body;
	if (req.method === 'POST') {
		body = {
			payload: req.body,
			channel: req.body.channel || 'AddTodo',
			subId: req.body.subId || 'todoList',
			type: req.body.type || 'announce',
			sendToSender: true
		};
	}else if (req.method === 'PUT') {
		body = {
			payload: req.body,
			channel: req.body.channel || 'EditTodo',
			subId: req.body.subId || 'todoList',
			type: req.body.type || 'announce',
			sendToSender: true
		};
	}else if (req.method === 'DELETE') {
		// req.params not available here
		const id = req.url.replace('/', '');
		body = {
			payload: {todoId: id},
			channel: req.body.channel || 'DeleteTodo',
			subId: req.body.subId || 'todoList',
			type: req.body.type || 'announce',
			sendToSender: true
		}
	}
	if (body) {
		global.socketEmitter.emit(body.channel, body.channel, body.subId, body.type, body.payload);
	}
	next();
}

// Startup the express server
server.listen(3001, () => {
	console.log('express listening on port 3001');
});
