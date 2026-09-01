function buildScholarshipFilter(q) {
  const filter = {};
  const rawQ = String(q.q || q.search || "").trim();
  if (rawQ) {
    const rx = { $regex: rawQ.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [
      { universityName: rx },
      { scholarshipCategory: rx },
      { subjectName: rx },
      { scholarshipDescription: rx },
      { country: rx },
      { city: rx },
      { degree: rx },
    ];
  }
  const cat = String(q.category || q.scholarshipCategory || "").trim();
  if (cat) filter.scholarshipCategory = cat;
  const subject = String(q.subject || q.subjectName || "").trim();
  if (subject) filter.subjectName = subject;
  const degree = String(q.degree || "").trim();
  if (degree) filter.degree = degree;
  const country = String(q.country || "").trim();
  if (country) filter.country = { $regex: `^${country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };
  const city = String(q.city || "").trim();
  if (city) filter.city = { $regex: `^${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };
  const maxFees = q.maxFees !== undefined && q.maxFees !== "" ? Number(q.maxFees) : NaN;
  if (Number.isFinite(maxFees)) filter.applicationFees = { $lte: maxFees };
  const deadlineAfter = String(q.deadlineAfter || "").trim();
  if (deadlineAfter) filter.applicationDeadline = { $gte: deadlineAfter };
  const tag = String(q.tag || "").trim();
  if (tag) filter.tags = tag;
  return filter;
}

function buildScholarshipSort(sort) {
  const s = String(sort || "newest").toLowerCase();
  if (s === "rating" || s === "recommended") return { rating: -1, reviewsCount: -1 };
  if (s === "deadline" || s === "deadline-asc") return { applicationDeadline: 1 };
  if (s === "fees-asc" || s === "fees" || s === "price-asc") return { applicationFees: 1 };
  if (s === "fees-desc" || s === "price-desc") return { applicationFees: -1 };
  if (s === "newest") return { postDate: -1, _id: -1 };
  if (s === "oldest") return { postDate: 1 };
  return { postDate: -1, _id: -1 };
}

function normalizeScholarshipDoc(doc) {
  if (!Array.isArray(doc.eligibility)) doc.eligibility = doc.eligibility ? [String(doc.eligibility)] : [];
  if (!Array.isArray(doc.benefits)) doc.benefits = doc.benefits ? [String(doc.benefits)] : [];
  if (!Array.isArray(doc.tags)) doc.tags = doc.tags ? [String(doc.tags)] : [];
  if (!Array.isArray(doc.gallery)) doc.gallery = doc.gallery ? (Array.isArray(doc.gallery) ? doc.gallery : [String(doc.gallery)]) : [];
  if (!Array.isArray(doc.documents)) doc.documents = doc.documents ? [String(doc.documents)] : [];
  if (!Array.isArray(doc.requirements)) doc.requirements = doc.requirements ? [String(doc.requirements)] : [];
  if (!Array.isArray(doc.faqs)) doc.faqs = [];
  else doc.faqs = doc.faqs.slice(0, 10).map((f) => ({ q: String(f.q || f.question || "").slice(0, 200), a: String(f.a || f.answer || "").slice(0, 800) })).filter((f) => f.q && f.a);
  if (!Array.isArray(doc.highlights)) doc.highlights = doc.highlights ? [String(doc.highlights)] : [];
  if (doc.videoUrl) doc.videoUrl = String(doc.videoUrl).trim().slice(0, 500) || null;
  if (doc.videoPoster) doc.videoPoster = String(doc.videoPoster).trim().slice(0, 500) || null;
  if (doc.brochureUrl) doc.brochureUrl = String(doc.brochureUrl).trim().slice(0, 500) || null;
  if (doc.mapUrl) doc.mapUrl = String(doc.mapUrl).trim().slice(0, 500) || null;
  if (doc.gallery.length === 0 && doc.universityImage) doc.gallery = [doc.universityImage];
  doc.gallery = doc.gallery.map((u) => String(u).trim()).filter(Boolean).slice(0, 8);
  if (!doc.currency) doc.currency = "USD";
  if (!doc.duration) doc.duration = doc.duration || null;
  if (doc.applicationFees !== undefined) doc.applicationFees = Number(doc.applicationFees);
  if (doc.serviceCharge !== undefined) doc.serviceCharge = Number(doc.serviceCharge);
  if (doc.stipend !== undefined && doc.stipend !== "") doc.stipend = Number(doc.stipend);
  if (doc.rating === undefined) doc.rating = 0;
  if (doc.reviewsCount === undefined) doc.reviewsCount = 0;
  if (!doc.postDate) doc.postDate = new Date().toISOString().slice(0, 10);
  return doc;
}

function normalizeScholarshipPatch(body) {
  const b = { ...body };
  delete b._id;
  delete b.subjectName2;
  if (b.applicationFees !== undefined) b.applicationFees = Number(b.applicationFees);
  if (b.serviceCharge !== undefined) b.serviceCharge = Number(b.serviceCharge);
  if (b.stipend !== undefined && b.stipend !== "") b.stipend = Number(b.stipend);
  if (Array.isArray(b.eligibility)) b.eligibility = b.eligibility.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
  if (Array.isArray(b.benefits)) b.benefits = b.benefits.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
  if (Array.isArray(b.tags)) b.tags = b.tags.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
  if (Array.isArray(b.gallery)) b.gallery = b.gallery.map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
  if (Array.isArray(b.documents)) b.documents = b.documents.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
  if (Array.isArray(b.requirements)) b.requirements = b.requirements.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
  if (Array.isArray(b.highlights)) b.highlights = b.highlights.map((s) => String(s).trim()).filter(Boolean).slice(0, 10);
  if (Array.isArray(b.faqs)) b.faqs = b.faqs.slice(0, 10).map((f) => ({ q: String(f.q || f.question || "").slice(0, 200), a: String(f.a || f.answer || "").slice(0, 800) })).filter((f) => f.q && f.a);
  if (b.videoUrl !== undefined) b.videoUrl = b.videoUrl ? String(b.videoUrl).trim().slice(0, 500) : null;
  if (b.videoPoster !== undefined) b.videoPoster = b.videoPoster ? String(b.videoPoster).trim().slice(0, 500) : null;
  if (b.brochureUrl !== undefined) b.brochureUrl = b.brochureUrl ? String(b.brochureUrl).trim().slice(0, 500) : null;
  if (b.mapUrl !== undefined) b.mapUrl = b.mapUrl ? String(b.mapUrl).trim().slice(0, 500) : null;
  return b;
}

module.exports = { buildScholarshipFilter, buildScholarshipSort, normalizeScholarshipDoc, normalizeScholarshipPatch };
