"use strict";

const contentDefaults = {
  kicker: "نداء إنساني عاجل",
  headline: "لنقف مع طالب يمني\nفي محنته",
  story: "باعت أسرته كل ما تملك لتغطية تكاليف دفن سيدة توفّيت إثر حادث مروري في شاندونغ بالصين. واليوم يبقى على الطالب دفع مبلغ التسوية المتفق عليه مع أسرتها.",
  appeal: "بعطائكم نعينه على الوفاء بالتسوية.",
  caption: "صورة تعبيرية",
  quote: "«مَا نَقَصَتْ صَدَقَةٌ مِنْ مَالٍ»",
  citation: "رواه مسلم (2588)",
  encouragement: "كل مساهمة تقرّبنا من الهدف",
  footer: "بإشراف الجاليات اليمنية واتحاد الطلاب اليمنيين في الصين",
  wechatTitle: "ويشات",
  alipayTitle: "أليباي (الجيفوباو)",
  bankTitle: "التحويل البنكي",
  bankNumber: "6210286018643344",
  bankHolder: "ALI MUNEER MUSAED ALI",
  qr1Name: "ويشات 1",
  qr2Name: "ويشات 2",
  qr3Name: "أليباي",
  qr1Image: "qr1.png",
  qr2Image: "qr2.png",
  qr3Image: "qr3.png"
};

const qrKeys = ["qr1", "qr2", "qr3"];
const formatPattern = /^data:image\/png;base64,[a-z0-9+/=]+$/i;

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image.decode().then(() => image);
}

async function prepareQr(file) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 15_000_000) {
    throw new Error("Unsupported image");
  }
  const url = URL.createObjectURL(file);
  try {
    const original = await loadImage(url);
    const image = document.createElement("canvas");
    const edge = Math.min(384, Math.max(original.naturalWidth, original.naturalHeight));
    const scale = edge / Math.max(original.naturalWidth, original.naturalHeight);
    image.width = Math.max(1, Math.round(original.naturalWidth * scale));
    image.height = Math.max(1, Math.round(original.naturalHeight * scale));
    const context = image.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, image.width, image.height);
    context.drawImage(original, 0, 0, image.width, image.height);
    return image.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function createPosterContent(onChange, onStorageFailure) {
  const supplied = window.campaignContent ?? {};
  const published = { ...contentDefaults };
  for (const key of Object.keys(published)) {
    const value = supplied[key];
    if (typeof value === "string" && (!key.endsWith("Image") || formatPattern.test(value))) {
      published[key] = value;
    }
  }
  const storageKey = "yemeni-student-campaign-content";
  const version = JSON.stringify(published);
  const signature = Array.from(version).reduce((hash, character) =>
    Math.imul(hash ^ character.codePointAt(0), 16777619), 2166136261);
  const values = { ...published };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.signature === signature && saved.values) Object.assign(values, saved.values);
  } catch {
    // The published content is available when browser storage is disabled.
  }

  const images = {};
  let loading = 0;
  let ready = false;
  const feedback = document.getElementById("payment-status");
  function persist() {
    try {
      const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== published[key]));
      localStorage.setItem(storageKey, JSON.stringify({ signature, values: changes }));
    } catch {
      onStorageFailure();
    }
  }

  function field(parent, key, title, maxLength, multiline = false, ltr = false) {
    const label = document.createElement("label");
    const control = document.createElement(multiline ? "textarea" : "input");
    if (multiline) control.rows = key === "story" ? 4 : 2;
    control.maxLength = maxLength;
    control.value = values[key];
    control.dir = ltr ? "ltr" : "auto";
    if (key === "bankNumber") control.inputMode = "numeric";
    control.addEventListener("input", () => {
      values[key] = control.value;
      persist();
      onChange();
    });
    label.append(title, control);
    parent.append(label);
  }

  const copyFields = document.getElementById("copy-fields");
  [
    ["kicker", "السطر أعلى العنوان", 50],
    ["headline", "العنوان الرئيسي", 85, true],
    ["story", "نص النداء", 300, true],
    ["appeal", "دعوة المساهمة", 100],
    ["caption", "وصف الصورة", 30],
    ["quote", "الحديث أو الاقتباس", 140],
    ["citation", "مصدر الاقتباس", 65],
    ["encouragement", "العبارة بجانب طرق التبرع", 70],
    ["footer", "جهة الإشراف أسفل الملصق", 120]
  ].forEach((definition) => field(copyFields, ...definition));

  const bankFields = document.getElementById("bank-fields");
  [
    ["wechatTitle", "عنوان مجموعة رموز ويشات", 40],
    ["alipayTitle", "عنوان مجموعة رمز أليباي", 35],
    ["bankTitle", "عنوان التحويل البنكي", 40],
    ["bankNumber", "رقم الحساب البنكي", 42, false, true],
    ["bankHolder", "اسم صاحب الحساب", 72]
  ].forEach((definition) => field(bankFields, ...definition));

  const qrFields = document.getElementById("qr-fields");
  const initialImages = qrKeys.map(async (key, index) => {
    const row = document.createElement("div");
    row.className = "qr-field";
    const preview = document.createElement("img");
    preview.alt = "";
    const controls = document.createElement("div");
    field(controls, `${key}Name`, `اسم الرمز ${index + 1}`, 40);
    const label = document.createElement("label");
    const upload = document.createElement("input");
    upload.type = "file";
    upload.accept = "image/png,image/jpeg,image/webp";
    upload.disabled = true;
    label.append(`صورة الرمز ${index + 1}`, upload);
    controls.append(label);
    row.append(preview, controls);
    qrFields.append(row);

    const imageKey = `${key}Image`;
    const source = values[imageKey];
    try {
      images[key] = await loadImage(source);
    } catch {
      images[key] = await loadImage(contentDefaults[imageKey]);
      values[imageKey] = contentDefaults[imageKey];
      feedback.textContent = "تعذّر تحميل أحد الرموز المعدّلة. استُعيدت صورته الأصلية.";
    }
    preview.src = images[key].src;
    upload.disabled = false;
    upload.addEventListener("change", async () => {
      const [file] = upload.files;
      if (!file) return;
      upload.disabled = true;
      loading++;
      onChange();
      try {
        const data = await prepareQr(file);
        const image = await loadImage(data);
        values[imageKey] = data;
        images[key] = image;
        preview.src = data;
        persist();
        feedback.textContent = "تم تحديث صورة الرمز.";
      } catch {
        feedback.textContent = "تعذّر فتح الصورة. اختر ملف PNG أو JPG أو WebP بحجم 15 ميغابايت أو أقل.";
      } finally {
        upload.value = "";
        upload.disabled = false;
        loading--;
        onChange();
      }
    });
  });
  Promise.all(initialImages).then(() => {
    ready = true;
    onChange();
  }).catch(() => {
    feedback.textContent = "تعذّر تحميل رموز الدفع. أعد تحميل الصفحة.";
  });

  return {
    values, images,
    get ready() { return ready && loading === 0; }
  };
}
