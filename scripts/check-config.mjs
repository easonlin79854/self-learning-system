import { readFileSync } from "node:fs";

const files = ["src/main.js", "src/cloud.js", "src/styles.css", "index.html"];
const failures = files.filter((file) => readFileSync(file, "utf8").trim().length === 0);

if (failures.length) {
  console.error(`Empty required files: ${failures.join(", ")}`);
  process.exit(1);
}

const main = readFileSync("src/main.js", "utf8");
const requiredFeatures = ["考試成績", "雲端筆記本", "個人化設定", "蕃茄鐘", "規劃日曆", "AI 導師", "NVIDIA NIM"];
const missing = requiredFeatures.filter((feature) => !main.includes(feature));

if (missing.length) {
  console.error(`Missing feature labels: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Feature smoke check passed.");
