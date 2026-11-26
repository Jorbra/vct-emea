// Players' photos: Liquipedia's infobox first, else vlr.gg's avatar (lib/playerphoto.js).
import test from "node:test";
import assert from "node:assert/strict";
import { lpPhotoPath, photoOf, vlrPhotoUrl } from "../lib/playerphoto.js";

test("photos: Liquipedia's infobox picture, its placeholders left out", () => {
  const html = '<div class="infobox-image-wrapper"><div class="infobox-image"><a href="/x"><img src="/commons/images/thumb/6/6e/VIT_Derke_2026.jpg/600px-VIT_Derke_2026.jpg"></a></div></div>';
  assert.equal(lpPhotoPath(html), "6/6e/VIT_Derke_2026.jpg");
  assert.equal(lpPhotoPath('<div class="infobox-image"><img src="/commons/images/a/ab/Liquipedia_logo_placeholder.png"></div>'), "");
  assert.equal(lpPhotoPath("<div>no picture</div>"), "");
});

test("photos: vlr.gg's avatar, its silhouette left out", () => {
  assert.equal(vlrPhotoUrl('<div class="wf-avatar mod-player"><div><img src="//owcdn.net/img/69742b2cdd6c3.png" alt="Derke"></div></div>'), "https://owcdn.net/img/69742b2cdd6c3.png");
  assert.equal(vlrPhotoUrl('<div class="wf-avatar mod-player"><img src="/img/base/ph/sil.png"></div>'), "");
});

test("photos: Liquipedia first, then vlr.gg, else none", () => {
  assert.equal(photoOf("derke", { derke: { photo: "6/6e/A.jpg" } }, { derke: { photo: "https://owcdn.net/img/x.png" } }), "/api/lp-img?f=6%2F6e%2FA.jpg&w=240");
  assert.equal(photoOf("derke", {}, { derke: { photo: "https://owcdn.net/img/x.png" } }), "https://owcdn.net/img/x.png");
  assert.equal(photoOf("nobody", {}, {}), "");
});
