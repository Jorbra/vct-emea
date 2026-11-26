// The player sheet's extra information from Liquipedia: birth date, other names, signature agents, photo (lib/teaminfo.js).
import test from "node:test";
import assert from "node:assert/strict";
import { parsePlayerPage } from "../lib/teaminfo.js";

const row = (label, value) => `<div><div class="infobox-cell-2 infobox-description">${label}:</div><div>${value}</div></div>`;
const html = `<div class="fo-nttax-infobox"><div class="infobox-image-wrapper"><div class="infobox-image"><img src="/commons/images/thumb/6/6e/VIT_Derke.jpg/600px-VIT_Derke.jpg"></div></div>`
  + row("Romanized Name", "Nikita Sirmitev") + row("Born", "February  6, 2003 (age&#160;23)") + row("Status", "Active") + row("Alternate IDs", "Derkeps")
  + row("Signature Agents", '<a href="/valorant/Hush" title="Hush"><img alt="Hush" src="/x.png"></a>&#160;<a href="/valorant/Jett" title="Jett"><img alt="Jett" src="/y.png"></a>')
  + `<div class="infobox-header">Links</div></div><h2>History</h2>`;

test("player sheet: birth date, other names, signature agents and photo from Liquipedia", () => {
  const p = parsePlayerPage(html);
  assert.equal(p.name, "Nikita Sirmitev");
  assert.equal(p.born, "2003-02-06");
  assert.equal(p.altIds, "Derkeps");
  assert.deepEqual(p.signature, ["Hush", "Jett"]);
  assert.equal(p.photo, "6/6e/VIT_Derke.jpg");
});

test("player sheet: nothing made up when the page gives nothing", () => {
  const p = parsePlayerPage("<p>no infobox</p><h2>History</h2>");
  assert.equal(p.born, "");
  assert.equal(p.altIds, "");
  assert.deepEqual(p.signature, []);
  assert.equal(p.photo, "");
});
