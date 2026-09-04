const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");

async function recalcScholarshipRating(scholarShip_id) {
  try {
    if (!scholarShip_id) return;
    const sid = String(scholarShip_id);
    const { reviews, scholership } = getCollections();
    const agg = await reviews.aggregate([{ $match: { scholarShip_id: sid, status: "approved" } }, { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }]).toArray();
    if (!agg.length || agg[0].count === 0) {
      await scholership.updateOne({ _id: new ObjectId(sid) }, { $set: { rating: 0, reviewsCount: 0 } });
      return;
    }
    const avg = Math.round(agg[0].avg * 10) / 10;
    await scholership.updateOne({ _id: new ObjectId(sid) }, { $set: { rating: avg, reviewsCount: agg[0].count } });
  } catch (err) {
    console.log("recalc rating error", err.message);
  }
}

module.exports = { recalcScholarshipRating };
