import { getDb } from "../../../lib/db.js";
import { archiveSeason, clearResults, removeSeason } from "../../../lib/seasons.js";
import { badRequest, isAdmin, readBody, reply, unauthorised } from "../../../lib/session.js";

// { name }: archives the season as it stands. { remove: slug }: removes an archive. { clear: true }: clears every result.
export async function POST(req) {
  if (!(await isAdmin())) return unauthorised();
  const b = await readBody(req);
  if (!b) return badRequest();
  const db = getDb();
  if (b.clear === true) return reply(clearResults(db));
  if (b.remove) return reply(removeSeason(db, { slug: b.remove }));
  return reply(archiveSeason(db, { name: b.name }));
}
