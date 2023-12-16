require("dotenv").config();
const { default: axios } = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const api_url = process.env.API_URL;

console.log(api_url);
let globalChatId = null;

const confirms = [
  { id: "benar", name: "Benar" },
  { id: "ulangi", name: "Ulangi" },
];

let userState = {
  username: null,
  suara_calon_1: 0,
  suara_calon_2: 0,
  suara_calon_3: 0,
  suara_tidak_sah: 0,
  suara_sisa: 0,
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
      { text: confirm.name, callback_data: confirm.id },
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
    return true;
  } else {
    errorMessage(res.data.response_msg);
    return false;
  }
}

async function botWork(msg) {
  const chatId = msg.chat.id;

  if (botState.step == null) {
    console.log("access");
    botState.step = 0;
    botState.start_input = true;
  }

  console.log(botState.step);

  switch (botState.step) {
    case 0:
      bot.sendMessage(
        chatId,
        "Selamat datang, balas /mulai untuk memulai mengisi tabulasi suara"
      );
      botState.step = 1.1;
      break;
    case 1.1:
      if (msg.text != "/mulai") {
        bot.sendMessage(
          chatId,
          "Selamat datang, balas /mulai untuk memulai mengisi tabulasi suara"
        );
      } else {
        bot.sendMessage(chatId, "Masukkan suara Anies:");
        botState.step = 1;
      }
      break;
    case 1:
      processInput(
        msg.text,
        () => {
          bot.sendMessage(chatId, "Masukkan suara Anies:");
        },
        () => {
          userState.suara_calon_1 = msg.text;
          bot
            .sendMessage(chatId, "Masukkan suara Ganjar:")
            .finally(() => (botState.step = 2));
        }
      );
      break;
    case 2:
      processInput(
        msg.text,
        () => {
          bot.sendMessage(chatId, "Masukkan suara Ganjar:");
        },
        () => {
          userState.suara_calon_2 = msg.text;
          bot
            .sendMessage(chatId, "Masukkan suara Prabowo:")
            .finally(() => (botState.step = 3));
        }
      );
      break;
    case 3:
      processInput(
        msg.text,
        () => {
          bot.sendMessage(chatId, "Masukkan suara Prabowo:");
        },
        () => {
          userState.suara_calon_3 = msg.text;
          bot
            .sendMessage(chatId, "Masukkan suara tidak sah:")
            .finally(() => (botState.step = 4));
        }
      );
      break;
    case 4:
      processInput(
        msg.text,
        () => {
          bot.sendMessage(chatId, "Masukkan suara tidak sah:");
        },
        () => {
          userState.suara_tidak_sah = msg.text;
          bot
            .sendMessage(chatId, "Masukkan suara sisa:")
            .finally(() => (botState.step = 5));
        }
      );
      break;
    case 5:
      processInput(
        msg.text,
        () => {
          bot.sendMessage(chatId, "Masukkan suara sisa:");
        },
        () => {
          userState.suara_sisa = msg.text;
          // Menampilkan rekapitulasi suara
          const rekapitulasi = `Hasil input\n\nSuara Anies-Muhaimin: ${userState.suara_calon_1}\nSuara Ganjar-Mahfud: ${userState.suara_calon_2}\nSuara Prabowo-Gibran: ${userState.suara_calon_3}\nSuara tidak sah: ${userState.suara_tidak_sah}\nSuara sisa: ${userState.suara_sisa}\n
        `;
          bot.sendMessage(
            chatId,
            `Apakah yang diinputkan sudah benar?\n\n${rekapitulasi}`,
            confirmKeyboard
          );
          botState.step = 6;
        }
      );
      break;
    case 6:
      // Menampilkan rekapitulasi suara
      const rekapitulasi = `Hasil input\n\nSuara Anies-Muhaimin: ${userState.suara_calon_1}\nSuara Ganjar-Mahfud: ${userState.suara_calon_2}\nSuara Prabowo-Gibran: ${userState.suara_calon_3}\nSuara tidak sah: ${userState.suara_tidak_sah}\nSuara sisa: ${userState.suara_sisa}\n
        `;
      bot.sendMessage(
        chatId,
        `Apakah yang diinputkan sudah benar?\n\n${rekapitulasi}`,
        confirmKeyboard
      );
      botState.step = 7;
      break;

    case 7:
      // Menanggapi konfirmasi
      if (msg.text === "Benar") {
        bot.sendMessage(chatId, "Terima kasih atas partisipasi Anda!");
        // Melakukan sesuatu dengan data suara yang telah diinput
        // Misalnya, menyimpan data ke database atau melakukan tindakan lainnya
        resetBotState(); // Reset state untuk pengguna berikutnya
      } else if (msg.text === "Ulangi") {
        bot.sendMessage(chatId, "Silahkan ulangi proses input suara.");
        resetUserState(); // Reset state untuk memulai ulang proses input suara
        botState.step = 1; // Langsung kembali ke langkah pertama
      } else {
        bot.sendMessage(chatId, 'Silahkan pilih "Benar" atau "Ulangi".');
      }
      break;
    default:
      break;
  }
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  userState.username = msg.from.username;
  globalChatId = chatId;

  let validate = await axios.post(api_url + "validate_user", {
    username: msg.from.username,
  });

  validate.status !== 200 && errorMessage();
  validate.data.response_code !== "00" && errorMessage();
  if (validate.data.response_code == "00") {
    botWork(msg);
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  switch (data) {
    case "benar":
      bot.sendMessage(chatId, "Terima kasih atas konfirmasinya!");
      konfirm_suara = await apiCall("konfirmasi_suara", "post", userState);
      if (konfirm_suara) {
        resetUserState();
        botState.step = null;
        botState.start_input = false;
      }
      break;
    case "ulangi":
      bot.sendMessage(chatId, "Silahkan ulangi proses input suara.");
      resetUserState(); // Reset state untuk memulai ulang proses input suara
      botState.step = 1; // Langsung kembali ke langkah pertama
      break;
    // Tambahkan case untuk callback query lainnya sesuai kebutuhan
    default:
      bot.sendMessage(chatId, "Tombol belum diimplementasikan.");
  }
});

function resetUserState() {
  userState.foto_c1 = null;
  userState.suara_calon_1 = 0;
  userState.suara_calon_2 = 0;
  userState.suara_calon_3 = 0;
  userState.suara_sisa = 0;
  userState.suara_tidak_sah = 0;
}
