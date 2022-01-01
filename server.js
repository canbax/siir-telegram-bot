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

function errResponseFn(err, res) {
  console.log(err);
  res.write("Error: ", JSON.stringify(err));
  res.end();
}

// get telegram updates using webhook
app.post("/tupdate", async (req, res) => {
  try {
    console.log("telegram update come with message: ", req.body.message.text);
    await processInput(req.body.message.text, req.body.message.chat.id);
    res.write("received telegram update: ", req.body);
    res.end();
  } catch (err) {
    console.log("request body: ", typeof req.body, req.body);
    errResponseFn(err, res);
  }
});

// respond to gitlab request
app.post("/daily", async (req, res) => {
  try {
    console.log("daily post: ", typeof req.body, req.body);
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
    console.log("request body: ", typeof req.body, req.body);
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
  await got(url)
    .then((response) => {
      const b = response.body;
      const $ = cheerio.load(b);
      const title = $(".pd-title-a").text().trim();
      const text = $(".pd-text").text().trim();
      console.log("title : ", title.trim());
      console.log("text : ", text);
      return title + "\n" + text;
    })
    .catch((error) => {
      console.log(error);
    });
  return "";
}

async function hasWebhook() {
  try {
    const { body } = await got(URL + "getWebhookInfo");
    console.log("has web hook: ", body);
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
