// A Discord error in words for people (the bot's answers, the editor's dashboard). Pure, imports nothing.

// Discord's error codes the bot meets most, said plainly (https://discord.com/developers/docs/topics/opcodes-and-status-codes)
const DISCORD_ERRORS = {
  10003: ["❌ Ce salon ou ce fil n'existe plus sur Discord : il a sans doute été supprimé.", "❌ This channel or thread no longer exists on Discord: it was probably deleted."],
  10004: ["❌ Le bot n'est plus sur ce serveur.", "❌ The bot is no longer on this server."],
  10007: ["❌ Ce membre n'est plus sur le serveur.", "❌ This member is no longer on the server."],
  10008: ["❌ Ce message n'existe plus : il a sans doute été supprimé.", "❌ This message no longer exists: it was probably deleted."],
  10011: ["❌ Ce rôle n'existe plus sur le serveur.", "❌ This role no longer exists on the server."],
  10013: ["❌ Ce compte Discord n'existe pas.", "❌ This Discord account does not exist."],
  10026: ["❌ Cet utilisateur n'est pas banni.", "❌ This user is not banned."],
  50001: ["❌ Le bot ne voit pas ce salon : donne-lui l'accès (Voir le salon) dans ses permissions.", "❌ The bot cannot see this channel: give it access (View Channel) in its permissions."],
  50007: ["❌ Ce membre n'accepte pas les messages privés du bot.", "❌ This member does not accept private messages from the bot."],
  50013: ["❌ Le bot n'a pas le droit de faire ça ici : donne-lui la permission, et place son rôle au-dessus de celui du membre.", "❌ The bot is not allowed to do this here: give it the permission, and put its role above the member's."],
  50035: ["❌ Discord trouve le message invalide (trop long, ou un champ vide).", "❌ Discord finds the message invalid (too long, or an empty field)."],
  50083: ["❌ Ce fil est archivé : rouvre-le d'abord.", "❌ This thread is archived: reopen it first."],
  160005: ["❌ Ce fil est verrouillé : rouvre-le d'abord.", "❌ This thread is locked: reopen it first."],
};

/** A Discord error in words for people: the known codes said plainly, else Discord's own words. */
export function failText(e, L = (fr) => fr) {
  const known = e && DISCORD_ERRORS[e.code];
  if (known) return L(known[0], known[1]);
  if (e && e.status === 403) return L(DISCORD_ERRORS[50013][0], DISCORD_ERRORS[50013][1]);
  if (e && e.status === 429) return L("❌ Discord demande d'attendre un peu (trop de demandes) : réessaie dans une minute.", "❌ Discord asks to wait a little (too many requests): try again in a minute.");
  if (e && e.status >= 500) return L("❌ Discord ne répond pas pour le moment : réessaie dans quelques minutes.", "❌ Discord is not answering right now: try again in a few minutes.");
  return L(`❌ Discord a refusé : ${(e && e.message) || "erreur"}`, `❌ Discord refused: ${(e && e.message) || "error"}`);
}
