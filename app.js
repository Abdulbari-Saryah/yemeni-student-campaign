"use strict";

const form = document.getElementById("amounts");
const keys = ["union", "wechat", "alipay", "bank", "pledges", "goal"];
const inputs = keys.map((key) => form.elements.namedItem(key));
const defaults = window.campaignAmounts;
const publishedVersion = JSON.stringify(defaults);
const storageKey = "yemeni-student-campaign-amounts";
const poster = document.getElementById("poster");
const context = poster.getContext("2d");
const template = new Image();
const download = document.getElementById("download");
const settings = document.getElementById("download-settings");
const error = document.getElementById("error");
const status = document.getElementById("status");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const integer = new Intl.NumberFormat("en-US");
const decimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let current;
let frame = 0;
let displayed = [0, 0];
let templateReady = false;

function parseYuan(value) {
  const normalized = value.trim()
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
  if (!/^(?:\d{1,8}|\d{1,3}(?:,\d{3}){1,2})(?:\.\d{1,2})?$/.test(normalized)) return NaN;
  const [whole, fraction = ""] = normalized.replaceAll(",", "").split(".");
  if (Number(whole) > 99_999_999) return NaN;
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function formatAmount(cents, alwaysDecimals = false) {
  return (alwaysDecimals || cents % 100 ? decimal : integer).format(cents / 100);
}

function fill(values) {
  inputs.forEach((input) => { input.value = values[input.name] ?? ""; });
}

function save() {
  try {
    const fields = Object.fromEntries(inputs.map((input) => [input.name, input.value]));
    localStorage.setItem(storageKey, JSON.stringify({ publishedVersion, fields }));
  } catch {
    status.textContent = "حفظ التعديلات في هذا المتصفح غير متاح.";
  }
}

function readSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.publishedVersion === publishedVersion && saved.fields) return saved.fields;
  } catch {
    // The published amounts are also available with browser storage disabled.
  }
  return defaults;
}

function update() {
  const values = {};
  let invalid = false;
  for (const input of inputs) {
    const optional = input.name === "bank" && ["", "-"].includes(input.value.trim());
    const amount = optional ? null : parseYuan(input.value);
    const bad = Number.isNaN(amount) || (input.name === "goal" && amount === 0);
    input.setAttribute("aria-invalid", String(bad));
    invalid ||= bad;
    values[input.name] = amount;
  }
  error.hidden = !invalid;
  download.disabled = invalid || !templateReady;
  settings.disabled = invalid;
  if (invalid) return;

  const received = values.union + values.wechat + values.alipay + (values.bank ?? 0);
  const total = received + values.pledges;
  const percent = Math.round(100 * total / values.goal);
  const cashFraction = Math.min(1, received / values.goal);
  const totalFraction = Math.min(1, total / values.goal);
  current = { values, received, total, percent, cashFraction, totalFraction };

  document.getElementById("total").textContent = formatAmount(total, true);
  document.getElementById("percent").textContent = `${percent}%`;
  document.getElementById("received").textContent = formatAmount(received, true);
  document.getElementById("pledged").textContent = formatAmount(values.pledges);
  document.getElementById("progress").setAttribute("aria-valuenow", Math.min(100, percent));
  document.getElementById("received-bar").style.width = `${cashFraction * 100}%`;
  document.getElementById("pledge-bar").style.width = `${(totalFraction - cashFraction) * 100}%`;
  if (templateReady) animatePoster();
}

function rectangle(x, y, width, height, radius, fillColor) {
  context.fillStyle = fillColor;
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function text(value, x, y, { color = "#142c25", font, align = "right", direction = "rtl", maxWidth } = {}) {
  context.fillStyle = color;
  context.font = font;
  context.textAlign = align;
  context.direction = direction;
  if (maxWidth === undefined) context.fillText(value, x, y);
  else context.fillText(value, x, y, maxWidth);
  return context.measureText(value).width;
}

function paintPoster(cashFraction, totalFraction) {
  const { values, received, total, percent } = current;
  context.setTransform(2, 0, 0, 2, 0, 0);
  context.drawImage(template, 0, 0, poster.width / 2, poster.height / 2);
  const totalWidth = text(formatAmount(total, true), 1331, 628, {
    font: '700 88px "Segoe UI", Arial', direction: "ltr"
  });
  text("يوان", 1316 - totalWidth, 628, { font: "700 31px Tahoma, Arial", color: "#4b6157" });
  const badge = `نحو ⁦${percent}%⁩ من الهدف`;
  context.font = "700 30px Tahoma, Arial";
  const badgeWidth = context.measureText(badge).width + 36;
  rectangle(109, 489, badgeWidth, 56, 15, "#edf3e9");
  text(badge, 109 + badgeWidth / 2, 527, {
    font: "700 30px Tahoma, Arial", color: "#215541", align: "center"
  });

  const x = 109, y = 668, width = 1222, height = 28;
  rectangle(x, y, width, height, 14, "#e3eae0");
  context.save();
  context.clip();
  const cashStart = x + width * (1 - cashFraction);
  context.fillStyle = "#227654";
  context.fillRect(cashStart, y, width * cashFraction, height);
  const pledgeStart = x + width * (1 - totalFraction);
  context.beginPath();
  context.rect(pledgeStart, y, cashStart - pledgeStart, height);
  context.clip();
  context.fillStyle = "#e8bd72";
  context.fillRect(pledgeStart, y, cashStart - pledgeStart, height);
  context.strokeStyle = "#b98037";
  context.lineWidth = 3;
  context.beginPath();
  for (let stripe = pledgeStart - height; stripe < cashStart; stripe += 8) {
    context.moveTo(stripe, y + height);
    context.lineTo(stripe + height, y);
  }
  context.stroke();
  context.restore();

  const summaryFont = "23px Tahoma, Arial";
  rectangle(1318, 725, 13, 13, 6.5, "#227654");
  text(`المستلم ⁦${formatAmount(received, true)}⁩ يوان`, 1308, 739, { font: summaryFont });
  rectangle(1011, 725, 13, 13, 6.5, "#bc863d");
  text(`التعهدات ⁦${formatAmount(values.pledges)}⁩ يوان`, 1001, 739, { font: summaryFont });
  text(`الهدف ⁦${formatAmount(values.goal)}⁩ يوان`, 109, 739, { font: "700 23px Tahoma, Arial", align: "left" });

  [1352, 1089.6, 827.2, 564.8, 302.4].forEach((right, index) => {
    const amount = values[keys[index]];
    text(amount === null ? "-" : formatAmount(amount), right, 952, {
      font: '700 32px "Segoe UI", Arial', direction: "ltr", maxWidth: 222
    });
  });
}

function animatePoster() {
  cancelAnimationFrame(frame);
  const start = displayed;
  const end = [current.cashFraction, current.totalFraction];
  if (motion.matches || (start[0] === end[0] && start[1] === end[1])) {
    displayed = end;
    paintPoster(...displayed);
    return;
  }
  const began = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - began) / 260);
    const eased = 1 - (1 - progress) ** 3;
    displayed = end.map((fraction, index) => start[index] + (fraction - start[index]) * eased);
    paintPoster(...displayed);
    if (progress < 1) frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
}

function saveFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function feedback(message) {
  status.textContent = message;
  status.scrollIntoView({ block: "nearest" });
}

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", () => {
  status.textContent = "";
  update();
  if (error.hidden) save();
});
document.getElementById("reset").addEventListener("click", () => {
  fill(defaults);
  update();
  save();
  feedback("تمت استعادة الأرقام المنشورة.");
});
download.addEventListener("click", () => {
  cancelAnimationFrame(frame);
  displayed = [current.cashFraction, current.totalFraction];
  paintPoster(...displayed);
  try {
    poster.toBlob((blob) => {
      if (blob) saveFile(blob, "Yemeni-Student-Campaign.png");
      else feedback("تعذّر تجهيز الصورة. أعد تحميل الصفحة وحاول مرة أخرى.");
    }, "image/png");
  } catch {
    feedback("افتح الموقع من رابط GitHub Pages أو من خادم محلي لتنزيل الصورة.");
  }
});
settings.addEventListener("click", () => {
  const values = Object.fromEntries(Object.entries(current.values).map(([key, cents]) => [
    key, cents === null ? null : cents / 100
  ]));
  const file = new Blob([`window.campaignAmounts = ${JSON.stringify(values, null, 2)};\n`], {
    type: "text/javascript;charset=utf-8"
  });
  saveFile(file, "campaign.js");
});

fill(readSaved());
update();
template.addEventListener("load", () => {
  templateReady = true;
  if (current) {
    displayed = [current.cashFraction, current.totalFraction];
    paintPoster(...displayed);
  }
  download.disabled = !error.hidden;
});
template.addEventListener("error", () => feedback("تعذّر تحميل قالب الملصق. أعد تحميل الصفحة."));
template.src = "poster-template.png";
