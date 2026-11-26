// In the browser, Turkish and Arabic are not in the site's scripts (20 KB that nearly every visitor downloaded for nothing):
// the page brings the one its visitor reads, in window.__vctDict (app/layout.js), read once here. The server and the tests
// get lib/i18n-more.js instead (package.json "imports", "#extra-dicts").
const given = typeof window !== "undefined" && window.__vctDict ? window.__vctDict : null;
export const TR = given && given.lang === "tr" ? given.d : {};
export const AR = given && given.lang === "ar" ? given.d : {};
/** The languages whose words come with the page: switching to one of them loads the page again. */
export const WITH_PAGE = ["tr", "ar"];
