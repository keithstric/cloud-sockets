(function() {
		const messages = document.querySelector('#messages');
		const message = document.getElementById('messageField');
		const wsConnect = document.querySelector('#wsConnect');
		const wsSend = document.querySelector('#wsSend');
		const wsClear = document.querySelector('#wsClear');
		const wsDetails = document.querySelector('#wsDetails');
		const wsSubscribe = document.querySelector('#wsSubscribe');
		const wsAnnounce = document.querySelector('#wsAnnounce');
		const wsUnsubscribe = document.querySelector('#wsUnsubscribe');
		const wsAck = document.querySelector('#wsAck');

		window.onload = function() {
			wsSend.disabled = true;
			wsClear.disabled = true;
			wsDetails.disabled = true;
			wsConnect.click();
		}

		/**
		 * Add a card/message to the UI
		 * @param {string} message
		 * @param {http|from|to|error|status} displayClass
		 */
		function showMessage(message, displayClass) {
			const html = `
<div class="message ${displayClass || 'http'}">
	<pre>${message}</pre>
</div>`;
			const innerHtml = `${messages.innerHTML}${html}`;
			messages.innerHTML = innerHtml;
			messages.scrollTop = messages.scrollHeight;
		}

		/**
		 * Stringify an object to display in the cards
		 * @param {any} response
		 * @returns {string}
		 */
		function deepStringify(response) {
			if (response && response.user) {
				response.user = JSON.parse(response.user);
			}
			return JSON.stringify(response, null, 2);
		}

		/**
		 * Set the value of the textarea
		 * @param {string} value
		 */
		function setTextareaValue(value) {
			message.value = value;
		}

		let ws;

		/**
		 * Setup the connection and then instantiate all the listeners
		 */
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
				}
				console.log(`Error: ${msg}, evt=`, evt);
				showMessage(`WebSocket error: ${msg}`, 'error');
			};
			ws.onopen = function() {
				wsConnect.disabled = true;
				wsSend.disabled = false;
				wsClear.disabled = false;
				wsDetails.disabled = false;
				showMessage('WebSocket connection established', 'status');
			};
			ws.onclose = function() {
				wsConnect.disabled = false;
				wsSend.disabled = true;
				wsClear.disabled = true;
				wsDetails.disabled = true;
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
			}else{
				try {
					const msg = JSON.parse(message.value);
					const stringifiedMsg = JSON.stringify(msg, null, 2);
					ws.send(stringifiedMsg);
					showMessage(`Sent to WebSocket server:\n${stringifiedMsg}`, 'to');
				}catch (e) {
					showMessage(`Error in JSON: ${e.message}`, 'error');
					console.error(e);
				}
			}
		}

		wsClear.onclick = function() {
			messages.innerHTML = '';
		}

		wsDetails.onclick = function() {
			if (!ws) {
				showMessage('No WebSocket connection', 'error');
				return;
			}else{
				const msg = {
					type: "getInfoDetail"
				};
				const stringifiedMsg = JSON.stringify(msg, null, 2);
				ws.send(stringifiedMsg);
				showMessage(`Sent to WebSocket server:\n${stringifiedMsg}`, 'to');
			}
		}

		wsSubscribe.onclick = function() {
			const msg = {
				type: 'subscribe',
				channel: 'channel-1',
				subId: 'sub-1'
			};
			setTextareaValue(JSON.stringify(msg, null, 2));
		}

		wsAnnounce.onclick = function() {
			const msg = {
				type: 'announce',
				channel: 'channel-1',
				subId: 'sub-1',
				payload: 'This would be an Object or some sort of data',
				sendToSender: true
			};
			setTextareaValue(JSON.stringify(msg, null, 2));
		}

		wsUnsubscribe.onclick = function() {
			const msg = {
				type: 'unsubscribe',
				channel: 'channel-1',
				subId: 'sub-1'
			};
			setTextareaValue(JSON.stringify(msg, null, 2));
		}

		wsAck.onclick = function() {
			const msg = {
				type: 'ack',
				id: '##### Use the ID of the message you are acknowledging #####'
			};
			setTextareaValue(JSON.stringify(msg, null, 2));
		}

}());
