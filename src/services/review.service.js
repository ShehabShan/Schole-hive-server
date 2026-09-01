const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");

async function recalcScholarshipRating(scholarShip_id) {
  try {
    if (!scholarShip_id) return;
    const sid = String(scholarShip_id);
    const { reviews, scholership } = getCollections();
    const approved = await reviews.find({ scholarShip_id: sid, status: "approved" }).toArray();
    if (approved.length === 0) {
      await scholership.updateOne({ _id: new ObjectId(sid) }, { $set: { rating: 0, reviewsCount: 0 } });
      return;
    }
    const sum = approved.reduce((a, r) => a + (Number(r.rating) || 0), 0);
    const avg = Math.round((sum / approved.length) * 10) / 10;
    await scholership.updateOne({ _id: new ObjectId(sid) }, { $set: { rating: avg, reviewsCount: approved.length } });
  } catch (err) {
    console.log("recalc rating error", err.message);
  }
}

module.exports = { recalcScholarshipRating };
