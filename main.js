// A Cloudflare worker code for a telegram bot

const TOKEN = 'YOURTOKEN';
const WEBHOOK_ENDPOINT = '/endpoint';

addEventListener('fetch', event => {
	  event.respondWith(handleIncomingRequest(event));
});

async function handleIncomingRequest(event) {
	let url = new URL(event.request.url);
	let path = url.pathname;
	let method = event.request.method;
	let workerUrl = `${url.protocol}//${url.host}`;

	if (method === 'POST' && path === WEBHOOK_ENDPOINT) {
		const update = await event.request.json();
		event.waitUntil(processUpdate(update));

		return new Response('Ok');

	} else if (method === 'GET' && path === '/configure-webhook') {
		
		const url = `https://api.telegram.org/bot${TOKEN}/setWebhook?url=${workerUrl}${WEBHOOK_ENDPOINT}`;
		const response = await fetch(url);

		if (response.ok) {
			return new Response('Webhook configured successfully', {status: 200});
		} else {
			return new Response('Failed to configure webhook', {status: response.status});
		}
	} else {
		return new Response('Not Found', {status: 404});
	}
}

async function processUpdate(update) {
	if ("message" in update) {
		const chatId = update.message.chat.id;
		const userText = update.message.text;

		const responseText = `You said: ${userText}`;

		const url = `https://api.telegram.org/bot${TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseText)}`;
		
		await fetch(url);
	}
}
