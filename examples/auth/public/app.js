(function() {
		const messages = document.querySelector('#messages');
		const login = document.querySelector('#login');
		const logout = document.querySelector('#logout');
		const email = document.querySelector('#email');
		const wsConnect = document.querySelector('#wsConnect');
		const wsSend = document.querySelector('#wsSend');
		const wsClear = document.querySelector('#wsClear');

		function showMessage(message, displayClass) {
			const html = `<div class="message ${displayClass || 'http'}"><pre>${message}</pre></div>`
			const innerHtml = `${messages.innerHTML}${html}`;
			messages.innerHTML = innerHtml;
			messages.scrollTop = messages.scrollHeight;
		}

		function handleResponse(response) {
			return response.ok
				? response.json().then((data) => {return deepStringify(data)})
				: Promise.reject(new Error('Unexpected Response'));
		}

		function deepStringify(response) {
			if (response && response.user) {
				response.user = JSON.parse(response.user);
			}
			return JSON.stringify(response, null, 2);
		}

		login.onclick = function() {
			const payload = JSON.stringify({email: email.value}, null, 2);
			fetch('/login', {
				method: 'POST',
				credentials: 'same-origin',
				body: payload,
				headers: {
					'Content-Type': 'application/json'
				}
			})
				.then(handleResponse)
				.then(showMessage)
				.catch((err) => {
					showMessage(err.message, 'error');
				});
		};

		logout.onclick = function() {
			fetch('/logout', {method: 'DELETE', credentials: 'same-origin'})
				.then(handleResponse)
				.then(showMessage)
		};

		let ws;

		wsConnect.onclick = function() {
			if (ws) {
				ws.onerror = ws.onopen = ws.onclose = null;
				ws.close();
			}

			ws = new WebSocket(`ws://${location.host}`);
			ws.onerror = function(evt) {
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
					case 3:
						msg = 'Connection cannot be opened. You must be logged in.';
						break;
				}
				console.log(`Error: ${msg}, evt=`, evt);
				showMessage(`WebSocket error: ${msg}`, 'error');
			};
			ws.onopen = function() {
				console.log('onopen', arguments);
				showMessage('WebSocket connection established', 'status');
			};
			ws.onclose = function() {
				console.log('onclose', arguments);
				showMessage('WebSocket connection closed', 'status');
				ws = null;
			};
			ws.onmessage = function(msg) {
				console.log('onmessage', arguments);
				let dataStr = JSON.stringify(JSON.parse(msg.data), null, 2);
				dataStr = `Message from WebSocket server:\n${dataStr}`;
				showMessage(dataStr, 'from');
			}
		};

		wsSend.onclick = function() {
			if (!ws) {
				showMessage('No WebSocket connection', 'error');
				return;
			}else{
				// Using type of "broadcast" here so that it comes back to us, in all reality you would be using a type set to "notification"
				const msg = {
					type: 'broadcast',
					payload: 'Hello Knowhere',
					userTag: 'the.collector'
				};
				ws.send(JSON.stringify(msg));
				showMessage(`Sent to WebSocket server:\n${JSON.stringify(msg, null, 2)}`, 'to');
			}
		}

		wsClear.onclick = function() {
			messages.innerHTML = '';
		}

}());
