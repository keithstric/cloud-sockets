(function() {
		const messages = document.querySelector('#messages');
		const login = document.querySelector('#login');
		const logout = document.querySelector('#logout');
		const email = document.querySelector('#email');
		const wsConnect = document.querySelector('#wsConnect');
		const wsSend = document.querySelector('#wsSend')

		function showMessage(message) {
			messages.textContent = `\n${message}`;
			messages.scrollTop = messages.scrollHeight;
		}

		function handleResponse(response) {
			return response.ok
				? response.json().then((data) => {return JSON.stringify(data, null, 4)})
				: Promise.reject(new Error('Unexpected Response'));
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
					showMessage(err.message);
				});
		}

		logout.onclick = function() {
			fetch('/logout', {method: 'DELETE', credentials: 'same-origin'})
				.then(handleResponse)
				.then(showMessage)
		}

		let ws;

		wsConnect.onclick = function() {
			if (ws) {
				ws.onerror = ws.onopen = ws.onclose = null;
				ws.close();
			}

			ws = new WebSocket(`ws://${location.host}`);
			ws.onerror = function() {
				showMessage('WebSocket error');
			};
			ws.onopen = function() {
				showMessage('WebSocket connection established');
			};
			ws.onclose = function() {
				showMessage('WebSocket connection closed');
				ws = null;
			};
			ws.onmessage = function(msg) {
				let dataStr = JSON.stringify(JSON.parse(msg.data), null, 2);
				dataStr = `Message from WebSocket server:\n${dataStr}`;
				showMessage(dataStr);
			}
		};

		wsSend.onclick = function() {
			if (!ws) {
				showMessage('No WebSocket connection');
				return;
			}else{
				const msg = {
					type: 'notification',
					payload: 'Hello World',
					userTag: 'keith.strickland'
				};
				ws.send(JSON.stringify(msg));
				showMessage(`Sent to WebSocket server:\n${JSON.stringify(msg, null, 2)}`);
			}

		}

}());
