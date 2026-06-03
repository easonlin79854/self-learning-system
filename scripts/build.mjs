import { cpSync, mkdirSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/src", { recursive: true });
for (const file of ["index.html", "config.example.js", "config.js"]) cpSync(file, `dist/${file}`);
cpSync("src", "dist/src", { recursive: true });
console.log("Static app copied to dist/.");
