import {Component, OnDestroy, OnInit} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {ApiMethod} from '../../core/interfaces/api.interface';
import {HttpService} from '../../core/services/http/http.service';
import {UiService} from '../../core/services/ui/ui.service';
import {TodoDialogComponent} from './components/todo-dialog/todo-dialog.component';
import {Todo} from './interfaces/todo.interface';

@Component({
	selector: 'app-home',
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
	/**
	 * Array of todos
	 * @type {Todo[]}
	 */
	todos: Todo[] = [];
	/**
	 * true if connected to cloud-sockets server
	 * @type {boolean}
	 */
	connected: boolean = false;
	/**
	 * The WebSocket connection
	 * @type {WebSocket}
	 */
	ws: WebSocket;

	constructor(
		private _http: HttpService,
		private _dialog: MatDialog,
		private _ui: UiService
	) { }

	/**
	 * connect to the cloud-sockets server and fetch the list of todos
	 */
	ngOnInit(): void {
		this.connectWebsocket();
		this.fetchTodos();
	}

	/**
	 * Close the cloud-sockets connection
	 */
	ngOnDestroy() {
		this.ws.close();
	}

	/**
	 * Connect to the cloud-sockets server
	 * @event ConnectButton#click
	 */
	connectWebsocket() {
		this.ws = new WebSocket('ws://localhost:3001');
		this.ws.onerror = this.wsOnError.bind(this);
		this.ws.onopen = this.wsOnOpen.bind(this);
		this.ws.onclose = this.wsOnClose.bind(this);
		this.ws.onmessage = this.wsOnMessage.bind(this);
	}

	/**
	 * Fetch the list of todos
	 */
	fetchTodos() {
		this._http.requestCall('/api/todo', ApiMethod.GET)
			.subscribe((response: any[]) => {
				this.todos = response.sort((a, b) => {
					return a.id > b.id ? -1 : a.id < b.id ? 1 : 0;
				});
			});
	}

	/**
	 * Add a todo to the list of todos
	 * @event AddButton#click
	 */
	addButtonClick() {
		const dialogRef = this._dialog.open(TodoDialogComponent, {
			width: '400px',
			data: null
		});
		dialogRef.afterClosed()
			.subscribe((result) => {
				if (result) {
					this.handleDialog(result);
				}
			});
	}

	/**
	 * Edit a todo
	 * @param todo
	 * @event app-card#click
	 */
	todoCardClick(todo: Todo) {
		const dialogRef = this._dialog.open(TodoDialogComponent, {
			width: '400px',
			data: todo
		});
		dialogRef.afterClosed()
			.subscribe((result) => {
				if (result) {
					this.handleDialog(result);
				}
			});
	}

	/**
	 * Initiate the update from the dialog
	 * @param todo
	 */
	handleDialog(todo: Todo) {
		if (todo.id) {
			this.updateTodo(todo);
		}else {
			todo.id = new Date().getTime();
			this.createTodo(todo);
		}
	}

	/**
	 * Delete a todo
	 * @param evt
	 * @param todo
	 * @event DeleteTodoButton#click
	 */
	deleteTodoClick(evt, todo: Todo) {
		evt.stopPropagation();
		const dialogRef = this._ui.notifyUserShowConfirmDialog({
			title: `Delete todo "${todo.subject}?`,
			message: ''
		});
		dialogRef.afterClosed()
			.subscribe((result) => {
				if (result) {
					this.deleteTodo(todo.id);
				}
			});
	}

	/**
	 * Show the cloud-sockets server information
	 * @event InfoButton#click
	 */
	socketInfoClick() {
		const payload = JSON.stringify({type: "getInfoDetail"});
		this.ws.send(payload);
	}

	/**
	 * Show the help dialog
	 * @event HelpButton#click
	 */
	helpClick() {
		this._ui.notifyUserShowConfirmDialog({
			title: 'Help',
			messageHtml: `
<p>It is recommended that you open this application in two separate tabs. Then start adding todo items from each tab.</p>
<p>You should see todo items show up on both clients without the need to do a refresh.</p>
`,
			noCancelButton: true
		});
	}

	/**
	 * Send an edit request to the http server
	 * @param todo
	 */
	updateTodo(todo: Todo) {
		this._http.requestCall(`/api/todo/${todo.id}`, ApiMethod.PUT, todo)
			.subscribe((response: any) => {
				// We're doing nothing here so the Socket Server can handle it
			});
	}

	/**
	 * Actually update the local version of a todo
	 * @param todo
	 * @event WebSocketOnMessage
	 */
	updateLocalTodo(todo: Todo) {
		this.todos = this.todos.map((localTodo) => {
			if (localTodo.id === todo.id) {
				return todo;
			}
			return localTodo;
		});
	}

	/**
	 * Send a todo create request to the server
	 * @param todo
	 */
	createTodo(todo: Todo) {
		this._http.requestCall('/api/todo', ApiMethod.POST, todo)
			.subscribe((response: any) => {
				// We're doing nothing here so the Socket Server can handle it
			});
	}

	/**
	 * Add a new todo to the local list
	 * @param todo
	 * @event WebSocketOnMessage
	 */
	addLocalTodo(todo: Todo) {
		console.log('addLocalTodo, todo=', todo);
		if (this.todos) {
			this.todos.unshift(todo);
		}
	}

	/**
	 * Send a delete todo request to the server
	 * @param id
	 */
	deleteTodo(id: number) {
		this._http.requestCall(`/api/todo/${id}`, ApiMethod.DELETE)
			.subscribe((response) => {
				// We're doing nothing here so the Socket Server can handle it
			});
	}

	/**
	 * Delete a todo from the local list
	 * @param todoId
	 * @event WebSocketOnMessage
	 */
	deleteLocalTodo(todoId: number) {
		this.todos = this.todos.filter(todo => todo.id != todoId);
	}

	/**
	 * Websocket Error Handler
	 * @param evt
	 */
	wsOnError(evt: any) {
		let msg;
		switch(evt.currentTarget.readyState) {
			case 0:
				msg = 'No connection has yet been established';
				break;
			case 1:
				msg = 'Connection established';
				break;
			case 2:
				msg = 'Connection closing';
				break;
		}
		this._ui.notifyUserShowSnackbar(msg);
		this.connected = false;
	}

	/**
	 * WebSocket Open Handler
	 */
	wsOnOpen() {
		this._ui.notifyUserShowSnackbar('WebSocket connection established');
		this.connected = true;
		if (this.ws) {
			try {
				const addMsgObj = {
					type: 'subscribe',
					channel: 'AddTodo',
					subId: 'todoList'
				}
				this.ws.send(JSON.stringify(addMsgObj));
				const delMsgObj = {
					type: 'subscribe',
					channel: 'DeleteTodo',
					subId: 'todoList'
				}
				this.ws.send(JSON.stringify(delMsgObj));
				const editMsgObj = {
					type: 'subscribe',
					channel: 'EditTodo',
					subId: 'todoList'
				}
				this.ws.send(JSON.stringify(editMsgObj));
			}catch (e) {
				throw(e);
			}
		}
	}

	/**
	 * Websocket Close Handler
	 */
	wsOnClose() {
		this._ui.notifyUserShowSnackbar('WebSocket connection closed');
		this.connected = false;
		this.ws = null;
	}

	/**
	 * WebSocket message handler
	 * @param msg
	 */
	wsOnMessage(msg: MessageEvent) {
		this._ui.notifyUserShowConfirmDialog({
			title: 'Message from cloud-sockets server',
			confirmButtonText: 'OK',
			messageHtml: `<pre>${JSON.stringify(JSON.parse(msg.data), null, 2)}</pre>`,
			noCancelButton: true
		});
		const message = JSON.parse(msg.data);
		if (message.type === 'announce') {
			if (message.channel === 'AddTodo') {
				this.addLocalTodo(message.payload);
			} else if (message.channel === 'EditTodo') {
				this.updateLocalTodo(message.payload);
			} else if (message.channel === 'DeleteTodo') {
				this.deleteLocalTodo(message.payload.todoId);
			}
		}
	}

}
