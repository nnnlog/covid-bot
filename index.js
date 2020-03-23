process.env.NTBA_FIX_319 = 1;
process.env.TZ = "Asia/Seoul";

const setting = require("./setting");

const axios = require("axios");
var cheerio = require('cheerio');

const bot = new (require("node-telegram-bot-api"))(setting.token, {polling: true});

let data = []; //확진자, 완치, 격리중, 사망

const mt_rand = (min, max) => {
	let argc = arguments.length;
	if (argc === 0) {
		min = 0;
		max = 2147483647;
	} else if (argc === 1) {
		throw new Error('Warning: mt_rand() expects exactly 2 parameters, 1 given');
	} else {
		min = parseInt(min, 10);
		max = parseInt(max, 10);
	}
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

const numberWithCommas = x => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const targets = setting.targets;

const message = () => {
	return `${(new Date()).toLocaleString()} 기준\n코로나바이러스감염증-19 국내 발생현황\n
확진환자 : \`${numberWithCommas(data[1])}\`명
완치 : \`${numberWithCommas(data[2])}\`명
격리중 : \`${numberWithCommas(data[3])}\`명
사망 : \`${numberWithCommas(data[4])}\`명`;
};

const fetch_data = async () => {
	let hour = (new Date()).getHours();
	if (0 <= hour && hour <= 7) {
		console.log(`[INFO] ${(new Date()).toLocaleString()} > 새벽에는 갱신하지 않습니다.`);
	} else {
		console.log(`[INFO] ${(new Date()).toLocaleString()} > 갱신을 시작합니다.`);

		let raw_html = (await axios.get("http://ncov.mohw.go.kr/bdBoardList_Real.do")).data;
		let $ = cheerio.load(raw_html);

		let temp = [], invalid = false;
		for (let i = 1; i <= 4; i++) {
			temp[i] = parseInt($(`table[class=num]:nth-child(1) > tbody > tr > td:nth-child(${i})`).html().replace(/,/g, "").trim());
			invalid = invalid || temp[i] === undefined;
		}

		for (let i of [1, 2, 4]) { //줄어들 수 없는 부류 (확진자, 완치, 사망)
			if (data[i] !== undefined && temp[i] < data[i]) {
				invalid = true;
				break;
			}
		}

		if (invalid) {
			if (setting.owner_id) bot.sendMessage(setting.owner_id, `동기화 중 오류가 발생했습니다: \ntemp : \`${JSON.stringify(temp)}\`\ndata : \`${JSON.stringify(data)}\``, {
				parse_mode: "Markdown"
			});

			console.log(`[ERROR] ${(new Date()).toLocaleString()} > 동기화 중 오류 발생`);
			console.log(temp, data);
		} else {
			console.log(`[INFO] ${(new Date()).toLocaleString()} > 동기화 성공`);

			if (data.length) { //첫 실행이 아닌 경우
				let names = ["", "확진자", "완치", "격리중", "사망"];
				let updated = false;
				let msg = `${(new Date()).toLocaleString()} 기준\n코로나19 환자 변동 알림 : \n`;

				for (let i = 1; i <= 4; i++) {
					if (data[i] < temp[i]) {
						updated = true;

						msg += `${names[i]} : \`${numberWithCommas(temp[i])}\`명 \`(${numberWithCommas(temp[i] - data[i])}\`명 추가)\n`;
					} else {
						msg += `${names[i]} : \`${numberWithCommas(temp[i])}\`명\n`;
					}
				}

				if (updated) {
					for (let id of targets) {
						bot.sendMessage(id, msg, {
							parse_mode: "Markdown"
						});
					}
				}
			}

			data = temp;
		}
	}

	let t;
	setTimeout(fetch_data, t = 1000 * 60 * 6 * mt_rand(10, 15));

	console.log(`[INFO] ${(new Date()).toLocaleString()} > ${(new Date(t + Date.now())).toLocaleString()}에 갱신됩니다.`)
};

fetch_data();

bot.onText(/^\/info(?:@covid19_kr_bot)?$/g, (msg, match) => {
	bot.sendMessage(msg.chat.id, message(), {
		reply_to_message_id: msg.message_id,
		parse_mode: "Markdown"
	})
});
