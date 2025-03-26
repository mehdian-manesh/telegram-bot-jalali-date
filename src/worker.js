/**
 * Environment Variables:
 * 	- TOKEN
 *
 * KV Namespaces:
 *  - JALALI_KV
 */

const WEBHOOK_ENDPOINT = '/endpoint';

async function getSubscribers(env) {
	const data = await env.JALALI_KV.get("list");
	return data ? JSON.parse(data) : [];
}

async function setSubscribers(env, subscribers) {
	await env.JALALI_KV.put("list", JSON.stringify(subscribers));
}

async function subscribe(chatId, topicId, env) {
    let subscribers = await getSubscribers(env);

    const subscriber = { chatId, topicId };
    if (!subscribers.some(sub => sub.chatId === chatId && sub.topicId === topicId)) {
        subscribers.push(subscriber);
        await setSubscribers(env, subscribers);
        return "شما با موفقیت به لیست دریافت تاریخ اضافه شدید.";
    }

    return "شما قبلاً به لیست دریافت تاریخ اضافه شده‌اید.";
}

async function unsubscribe(chatId, topicId, env) {
    let subscribers = await getSubscribers(env);

    const subscriberIndex = subscribers.findIndex(sub => sub.chatId === chatId && sub.topicId === topicId);
    if (subscriberIndex !== -1) {
        subscribers.splice(subscriberIndex, 1);
        await setSubscribers(env, subscribers);
        return "شما از لیست دریافت تاریخ حذف شدید.";
    }

    return "شما در لیست دریافت تاریخ موجود نبودید.";
}

function nowJalali() {

	const now = new Date();
	const jDate = gregorianToJalali(
		now.getFullYear(),
		now.getMonth() + 1,
		now.getDate()
	);

	return formatJalaliDateForPersian(now, jDate);
}

// پردازش آپدیت دریافتی از تلگرام
async function processUpdate(update, env) {
	if ("message" in update) {
		const chatId = update.message.chat.id;
		const topicId = update.message.message_thread_id || null; // Capture the topic ID if available

		// Remove any mention (e.g., "@MY_BOT_NAME") from the command.
		const command = (update.message.text.trim()).split('@')[0].trim();

		let responseMsg;

		if (command === "/subscribe") {
			responseMsg = await subscribe(chatId, topicId, env);
		} else if (command === "/unsubscribe") {
			responseMsg = await unsubscribe(chatId, topicId, env);
		} else if (command === "/now") {
			responseMsg = nowJalali();
		} else {
			responseMsg = 'نفهمیدم چی گفتی! دوباره بفرست.';
		}

		// send response to the user
		let sendMessageUrl = `https://api.telegram.org/bot${env.TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(responseMsg)}`;
		if (topicId) {
			sendMessageUrl += `&message_thread_id=${topicId}`;
		}
		await fetch(sendMessageUrl);
	}
}

// ---------------------
// توابع مربوط به تبدیل تاریخ میلادی به شمسی
// ---------------------

function div(a, b) {
	return Math.floor(a / b);
}

function gregorianToJalali(gy, gm, gd) {
	const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
	let jy;
	if (gy > 1600) {
		jy = 979;
		gy -= 1600;
	} else {
		jy = 0;
		gy -= 621;
	}
	let days =
		365 * gy +
		div(gy + 3, 4) -
		div(gy + 99, 100) +
		div(gy + 399, 400);
	days += g_d_m[gm - 1] + gd - 1;
	if (gm > 2 && ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0))) {
		days++;
	}
	let j_day_no = days - 79;
	let j_np = div(j_day_no, 12053);
	j_day_no %= 12053;
	jy += 33 * j_np + 4 * div(j_day_no, 1461);
	j_day_no %= 1461;
	if (j_day_no >= 366) {
		jy += div(j_day_no - 1, 365);
		j_day_no = (j_day_no - 1) % 365;
	}
	let jm, jd;
	if (j_day_no < 186) {
		jm = 1 + div(j_day_no, 31);
		jd = 1 + (j_day_no % 31);
	} else {
		jm = 7 + div(j_day_no - 186, 30);
		jd = 1 + ((j_day_no - 186) % 30);
	}
	return { jy, jm, jd };
}

function formatJalaliDateForPersian(now, jDate) {
	const weekdayMapping = {
		0: "یکشنبه",
		1: "دوشنبه",
		2: "سه‌شنبه",
		3: "چهارشنبه",
		4: "پنجشنبه",
		5: "جمعه",
		6: "شنبه",
	};
	let weekday = weekdayMapping[now.getDay()];
	const persianMonths = {
		1: "فروردین",
		2: "اردیبهشت",
		3: "خرداد",
		4: "تیر",
		5: "مرداد",
		6: "شهریور",
		7: "مهر",
		8: "آبان",
		9: "آذر",
		10: "دی",
		11: "بهمن",
		12: "اسفند",
	};
	// تابع تبدیل ارقام لاتین به فارسی
	function toPersianDigits(str) {
		return str.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
	}
	const dayStr = toPersianDigits(jDate.jd.toString());
	const monthName = persianMonths[jDate.jm];
	const yearStr = toPersianDigits(jDate.jy.toString());
	return `${weekday}، ${dayStr} ${monthName} ${yearStr}`;
}

export default {
	async fetch(request, env, ctx) {
		let urlData = new URL(request.url);
		let path = urlData.pathname;
		let method = request.method;
		let workerUrl = `${urlData.protocol}//${urlData.host}`;

		if (method === 'POST' && path === WEBHOOK_ENDPOINT) {
			const update = await request.json();
			ctx.waitUntil(processUpdate(update, env));
			return new Response('Ok');
		} else if (method === 'GET' && path === '/configure-webhook') {
			const apiUrl = `https://api.telegram.org/bot${env.TOKEN}/setWebhook?url=${workerUrl}${WEBHOOK_ENDPOINT}`;
			const response = await fetch(apiUrl);
			if (response.ok) {
				return new Response('Webhook configured successfully', { status: 200 });
			} else {
				return new Response('Failed to configure webhook', { status: response.status });
			}
		} else {
			return new Response('Not Found', { status: 404 });
		}
	},

	async scheduled(event, env, ctx) {
		let subscribers = await getSubscribers(env);

		const dateStr = nowJalali();

		for (const { chatId, topicId } of subscribers) {
			let sendMessageUrl = `https://api.telegram.org/bot${env.TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(dateStr)}&disable_notification=true`;
			if (topicId) {
				sendMessageUrl += `&message_thread_id=${topicId}`;
			}
			await fetch(sendMessageUrl);
		}
	}
};
