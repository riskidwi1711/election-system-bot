require('dotenv').config()
const { default: axios } = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const api_url = process.env.API_URL;

console.log(api_url)
let globalChatId = null;

const confirms = [
  { id: 1, name: "Benar" },
  { id: 2, name: "Ulangi" },
];

let userState = {
  no_urut_calon: null,
  total_suara_sah: 0,
  total_suara_tidak_sah: 0,
  total_suara_sisa: 0,
  foto_c1: null,
};

let botState = {
  start_input: false,
  step: null,
  error: false,
};

const confirmKeyboard = {
  reply_markup: {
    inline_keyboard: confirms.map((confirm) => [
      { text: confirm.name, callback_data: `confirm_${confirm.id}` },
    ]),
  },
};

function processInput(input, onError, onSuccess) {
  input = parseInt(input);
  if (typeof input === "number" && !isNaN(input)) {
    onSuccess();
  } else {
    onError();
  }
}

function errorMessage(error = "Sistem dalam gangguan silahkan coba kembali") {
  console.log(`Error: ${error}`);
  bot.sendMessage(globalChatId, error);
}

async function capresData() {
  const res = await axios.get(api_url + "list_capres");

  if (res.status !== 200) {
    errorMessage();
    return false;
  }
  if (res.data.response_code !== "00") {
    errorMessage();
    return false;
  }
  if (res.data.response_code === "00") {
    return res.data.message;
  }
}

async function apiCall(endpoint, method = "GET", data = {}) {
  const res = await axios.request({
    method: method,
    url: api_url + endpoint,
    data: data,
  });

  console.log(`API RESPONSE: ${JSON.stringify(res.data)}`);

  if (res.status !== 200) {
    errorMessage();
    return false;
  }
  if (res.data.response_code !== "00") {
    errorMessage();
    return false;
  }
  if (res.data.response_code === "00") {
    return res.data.message;
  } else {
    errorMessage(res.data.response_msg);
    return false;
  }
}

async function botWork(msg) {
  const chatId = msg.chat.id;
  const photoPath = "./capres.webp";

  let list_capres = await apiCall("list_capres");

  const inlineKeyboard = {
    reply_markup: {
      inline_keyboard: list_capres.map((candidate) => [
        { text: candidate.name, callback_data: `vote_${candidate.id}` },
      ]),
    },
  };

  if (list_capres) {
    if (!userState.no_urut_calon) {
      bot.sendPhoto(chatId, photoPath).finally(async () => {
        bot.sendMessage(
          chatId,
          "Silahkan pilih calon presiden yang akan di inputkan suara nya.",
          inlineKeyboard
        );
      });
    }
  }

  switch (botState.step) {
    case 1:
      processInput(
        msg.text,
        () => {
          bot.sendMessage(chatId, "Silahkan masukan total suara sah :");
        },
        () => {
          userState.total_suara_sah = msg.text;
          bot
            .sendMessage(chatId, "Silahkan masukan total suara tidak sah :")
            .finally(() => (botState.step = 2));
        }
      );
      break;
    case 2:
      processInput(
        msg.text,
        () => {
          bot.sendMessage(chatId, "Silahkan masukan total suara tidak sah :");
        },
        () => {
          userState.total_suara_tidak_sah = msg.text;
          bot
            .sendMessage(chatId, "Silahkan masukan total suara sisa :")
            .finally(() => (botState.step = 3));
        }
      );
      break;
    case 3:
      processInput(
        msg.text,
        () => {
          bot.sendMessage(chatId, "Silahkan masukan total suara sisa :");
        },
        () => {
          userState.total_suara_sisa = msg.text;
          bot
            .sendMessage(chatId, "Silahkan masukan foto kertas C1 :")
            .finally(() => (botState.step = 4));
        }
      );
      break;
    case 4:
      const photoId = msg.photo
        ? msg.photo[msg.photo.length - 1].file_id
        : false;
      if (photoId) {
        userState.foto_c1 = photoId;
        bot.sendPhoto(chatId, photoId, { caption: "Foto C1:" }).finally(() =>
          bot
            .sendMessage(
              chatId,
              `Apakah sudah benar :\n${Object.keys(userState)
                .map((e) => {
                  if (
                    [
                      "total_suara_sah",
                      "total_suara_tidak_sah",
                      "total_suara_sisa",
                    ].includes(e)
                  ) {
                    return e.replace("_", " ") + " : " + userState[e];
                  }
                })
                .join("\n")}`,
              confirmKeyboard
            )
            .finally(() => (botState.step = 5))
        );
      } else {
        bot
          .sendMessage(chatId, "Silahkan masukan foto kertas C1 :")
          .finally(() => (botState.step = 4));
      }
      break;
    case 5:
      bot.sendMessage(chatId, "Pilih benar atau ulangi");
      break;
    default:
      break;
  }
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  globalChatId = chatId;

  let validate = await axios.post(api_url + "validate_user", {
    username: msg.from.username,
  });
  validate.status !== 200 && errorMessage();
  validate.data.response_code !== "00" && errorMessage();
  validate.data.response_code === "00" && botWork(msg);
});
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const username = query.from.username;
  const candidateId = parseInt(query.data.split("_")[1], 10);
  const queryString = query.data;

  if (queryString.startsWith("confirm_")) {
    if (queryString === "confirm_2") {
      botState.step = 1;
      userState.total_suara_sah = 0;
      userState.total_suara_sisa = 0;
      userState.total_suara_tidak_sah = 0;

      bot.answerCallbackQuery(
        query.id,
        `Saksi ${username} mengulangi input suara calon nomor urut ${candidateId}`
      );

      bot.sendMessage(chatId, "Silahkan masukan total suara sah :");
    } else if (queryString === "confirm_1") {
      bot.sendMessage(chatId, "Mohon tunggu bot sedang menyimpan input");
      bot
        .answerCallbackQuery(
          query.id,
          `Saksi ${username} selesai menginput suara calon nomor urut ${candidateId}`
        )
        .then(async () => {
          let save = await apiCall("save_suara", "POST", {
            username: username,
            no_urut_calon: userState.no_urut_calon,
            total_suara_sah: userState.total_suara_sah,
            total_suara_tidak_sah: userState.total_suara_tidak_sah,
            total_suara_sisa: userState.total_suara_sisa,
          });

          if (save) {
            bot.sendMessage(chatId, "Berhasil meyimpan tabulasi suara.");
          } else {
            bot.sendMessage(
              chatId,
              "Gagal menyimpan, silahkan ulangi beberapa saat lagi."
            );
          }
        })
        .finally(() => {
          botState.step = null;
          botState.start_input = false;
          userState.no_urut_calon = null;
          userState.total_suara_sah = 0;
          userState.total_suara_sisa = 0;
          userState.total_suara_tidak_sah = 0;
        });
    }
  } else if (queryString.startsWith("vote_")) {
    botState.step = 1;
    botState.start_input = true;
    userState.no_urut_calon = candidateId;

    bot.answerCallbackQuery(
      query.id,
      `Saksi ${username} akan menginput suara calon nomor urut ${candidateId}`
    );

    bot.sendMessage(chatId, "Silahkan masukan total suara sah :");
  }
});
