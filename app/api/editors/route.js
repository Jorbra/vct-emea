import { getDb } from "../../../lib/db.js";
import { addEditor, removeEditor } from "../../../lib/editors.js";
import { badRequest, currentEditor, readBody, reply, unauthorised } from "../../../lib/session.js";

// Accounts: only the main account manages them.
export async function POST(req) {
  const me = await currentEditor();
  if (!me || me.who) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  return reply(b.remove ? removeEditor(getDb(), { name: b.remove }) : addEditor(getDb(), { name: b.name, password: b.password }));
}
