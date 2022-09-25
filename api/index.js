// require("./env");
const express = require("express");
const app = express();
const got = require("got");
const bodyParser = require("body-parser");
const cheerio = require("cheerio");

// allow every browser to get response from this server, this MUST BE AT THE TOP
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.use(bodyParser.json());

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("'TELEGRAM_BOT_TOKEN' should be an environment variable");
  return -1;
}
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const URL = "https://api.telegram.org/bot" + TOKEN + "/";
const welcomeMsg =
  "Merhaba. Ben şiir getiren bir botum :) /siir komutu ile rastgele getirebilirsiniz.";


/**
 * @param  {string} ch single character
 */
function isLowLetter(ch) {
  const lows = `qwertyuıopğüasdfghjklşizxcvbnmöç.,?!'-/`;
  return lows.includes(ch);
}

/**
 * @param  {string} ch single character
 */
function isHighLetter(ch) {
  const highs = `QWERTYUIOPĞÜASDFGHJKLŞİZXCVBNMÖÇ`;
  return highs.includes(ch);
}

function errResponseFn(err, res) {
  console.log(err);
  res.write("Error: ", JSON.stringify(err));
  res.end();
}

// get telegram updates using webhook
app.post("/api/tupdate", async (req, res) => {
  try {
    await processInput(req.body.message.text, req.body.message.chat.id);
    res.write("received telegram update: ", req.body);
    res.end();
  } catch (err) {
    errResponseFn(err, res);
  }
});

// respond to gitlab request
app.post("/api/daily", async (req, res) => {
  try {
    if (req.body.pwd != TOKEN) {
      res.write("need password!");
      res.end();
    } else {
      let txt = await getRandomPoem();
      await sendTelegramMsg(txt, "@her_gun_siir");
      res.write("received daily post from gitlab");
      res.end();
    }
  } catch (err) {
    errResponseFn(err, res);
  }
});

async function processInput(txt, chatId) {
  if (txt == "/siir") {
    let s = await getRandomPoem();
    await sendTelegramMsg(s, chatId);
  } else if (txt == "/start") {
    await sendTelegramMsg(welcomeMsg, chatId);
  }
}

async function sendTelegramMsg(msg, chatId) {
  await got.post(URL + "sendMessage", {
    json: { chat_id: chatId, text: msg },
  });
}

async function getRandomPoem() {
  const url = "https://www.antoloji.com/siir/rastgele";
  const response = await got(url);
  const b = response.body;
  const $ = cheerio.load(b);
  const title = $(".pd-title-a").text().trim();
  let text = $(".pd-text").text().trim();
  text = fixCamelCase(text);
  return title + "\n\n" + text;
}

function fixCamelCase(s) {
  let r = '';
  for (let i = 0; i < s.length - 1; i++) {
    r += s[i];
    if (isLowLetter(s[i]) && isHighLetter(s[i + 1])) {
      r += '\n';
    }
  }
  r += s[s.length - 1];
  return r;
}

async function hasWebhook() {
  try {
    const { body } = await got(URL + "getWebhookInfo");
    const b = JSON.parse(body);
    return b.result.url.length > 0;
  } catch (err) {
    console.log("Error: ", err);
  }
}

async function setWebhook() {
  const webhook = "https://her-gun-siir.herokuapp.com/tupdate";
  try {
    if (await hasWebhook()) {
      return;
    }
    const { body } = await got(URL + "setWebhook?url=" + webhook);
    const b = JSON.parse(body);
    return b.result.url.length > 0;
  } catch (err) {
    console.log("Error: ", err);
  }
}

async function setCommands() {
  try {
    const b = {
      commands: [{ command: "siir", description: "Rastgele şiir getirir" }],
    };
    const { body } = await got.post(URL + "setMyCommands", { json: b });
  } catch (err) {
    console.log("Error: ", err);
  }
}

async function main() {
  app.use(express.static("public"));
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log("server on " + PORT));

  await setWebhook();
  await setCommands();
}

main();
