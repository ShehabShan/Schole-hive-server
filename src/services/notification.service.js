const { getCollections } = require("../config/db");

// Types: question_answered | answer_accepted | question_comment | comment_reply | question_followed
// Never throws — notification failures must not break the parent action.
async function createNotification({ recipientEmail, type, actorEmail = null, payload = {} }) {
  try {
    const recipient = String(recipientEmail || "").trim().toLowerCase();
    const actor = actorEmail ? String(actorEmail).trim().toLowerCase() : null;
    if (!recipient || !type) return;
    if (recipient === actor) return; // never notify yourself

    const { notifications } = getCollections();

    // daily cap: one notification per (recipient, type, actor, question) per 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dupeFilter = { recipientEmail: recipient, type, createdAt: { $gte: since } };
    if (actor) dupeFilter.actorEmail = actor;
    if (payload.questionId) dupeFilter["payload.questionId"] = String(payload.questionId);
    const dupe = await notifications.findOne(dupeFilter);
    if (dupe) return;

    await notifications.insertOne({
      recipientEmail: recipient,
      type,
      actorEmail: actor,
      payload,
      read: false,
      createdAt: new Date(),
    });
  } catch {
    // swallow — notifications are best-effort
  }
}

module.exports = { createNotification };
