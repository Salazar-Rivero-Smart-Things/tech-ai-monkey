import fs from 'fs';

const FILE = '.output/server/_libs/eve+zod.mjs';
let code = fs.readFileSync(FILE, 'utf8');

const regex = /this\.#keepaliveTimer = setInterval\(\(\) => \{\s*this\.#i\.shell\("echo ping"\)\.catch\(\(\) => \{\}\);\s*\}, 8000\);\s*this\.#keepaliveTimer\.unref\?\.\(\);/;

if (regex.test(code)) {
    code = code.replace(regex, 'this.#keepaliveTimer = this.#i.execStreamWith("sleep", (b) => b.args(["86400"])).catch(() => {});');
    fs.writeFileSync(FILE, code);
    console.log("Patched setInterval to execStreamWith!");
} else {
    console.log("Regex not found!");
}
