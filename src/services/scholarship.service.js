function buildScholarshipFilter(q) {
  const filter = {};
  const st = String(q.status || "").toLowerCase().trim();
  if (!st) {
    // hide drafts and scheduled (future) by default — public catalog shows only published
    filter.status = { $nin: ["draft", "scheduled"] };
  } else if (st === "all") { /* no filter — show all */ }
  else if (st === "draft" || st === "published") filter.status = st;
  else if (st === "scheduled") {
    filter.status = "scheduled";
    // for public profile, only show scheduled if institution allowed it (showScheduledOnProfile true)
    // if request includes createdBy/creatorEmail, filter by flag; otherwise show all scheduled (for owner manage)
    if (q.createdBy || q.creatorEmail || q.profileEmail) {
      filter.showScheduledOnProfile = true;
    }
  } else filter.status = String(q.status).trim();
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
  const strip = (s) => String(s || "").replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>?/gm, "").trim();
  const cleanArr = (arr, limit = 20) => (Array.isArray(arr) ? arr : arr ? [String(arr)] : []).map((s) => strip(s)).filter(Boolean).slice(0, limit);
  if (!Array.isArray(doc.eligibility)) doc.eligibility = cleanArr(doc.eligibility, 20);
  else doc.eligibility = doc.eligibility.map((s) => strip(s)).filter(Boolean).slice(0, 20);
  if (!Array.isArray(doc.benefits)) doc.benefits = cleanArr(doc.benefits, 20);
  else doc.benefits = doc.benefits.map((s) => strip(s)).filter(Boolean).slice(0, 20);
  if (!Array.isArray(doc.tags)) doc.tags = cleanArr(doc.tags, 20);
  else doc.tags = doc.tags.map((s) => strip(s)).filter(Boolean).slice(0, 20);
  if (!Array.isArray(doc.gallery)) doc.gallery = doc.gallery ? (Array.isArray(doc.gallery) ? doc.gallery : [String(doc.gallery)]) : [];
  if (!Array.isArray(doc.documents)) doc.documents = cleanArr(doc.documents, 20);
  else doc.documents = doc.documents.map((s) => strip(s)).filter(Boolean).slice(0, 20);
  if (!Array.isArray(doc.requirements)) doc.requirements = cleanArr(doc.requirements, 20);
  else doc.requirements = doc.requirements.map((s) => strip(s)).filter(Boolean).slice(0, 20);
  if (!Array.isArray(doc.faqs)) doc.faqs = [];
  else doc.faqs = doc.faqs.slice(0, 10).map((f) => ({ q: strip(String(f.q || f.question || "")).slice(0, 200), a: strip(String(f.a || f.answer || "")).slice(0, 800) })).filter((f) => f.q && f.a);
  if (!Array.isArray(doc.highlights)) doc.highlights = cleanArr(doc.highlights, 10);
  else doc.highlights = doc.highlights.map((s) => strip(s)).filter(Boolean).slice(0, 10);
  if (doc.videoUrl) doc.videoUrl = strip(String(doc.videoUrl)).slice(0, 500) || null;
  if (doc.videoPoster) doc.videoPoster = strip(String(doc.videoPoster)).slice(0, 500) || null;
  if (doc.brochureUrl) doc.brochureUrl = strip(String(doc.brochureUrl)).slice(0, 500) || null;
  if (doc.mapUrl) doc.mapUrl = strip(String(doc.mapUrl)).slice(0, 500) || null;
  if (doc.gallery.length === 0 && doc.universityImage) doc.gallery = [doc.universityImage];
  doc.gallery = doc.gallery.map((u) => String(u).trim()).filter(Boolean).slice(0, 8);
  if (!doc.currency) doc.currency = "USD";
  if (!doc.duration) doc.duration = strip(doc.duration || "") || null;
  // scheduled handling with publishAt and 30-day limit
  if (doc.publishAt) {
    const d = new Date(doc.publishAt);
    if (isNaN(d.getTime())) doc.publishAt = null;
    else {
      const now = new Date();
      const max = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (d <= now || d > max) throw new Error("publishAt must be future within 30 days");
      doc.publishAt = d;
    }
  } else {
    doc.publishAt = null;
  }
  if (!doc.status) doc.status = "published";
  else {
    const st = String(doc.status).toLowerCase();
    if (st === "draft") doc.status = "draft";
    else if (st === "scheduled") {
      if (!doc.publishAt) throw new Error("scheduled requires publishAt");
      doc.status = "scheduled";
    } else doc.status = "published";
  }
  if (doc.status === "draft") doc.publishAt = null;
  if (doc.showScheduledOnProfile !== undefined) doc.showScheduledOnProfile = !!doc.showScheduledOnProfile;
  else doc.showScheduledOnProfile = false;
  if (doc.universityName) doc.universityName = strip(doc.universityName).slice(0, 120);
  if (doc.scholarshipName) doc.scholarshipName = strip(doc.scholarshipName).slice(0, 200);
  if (doc.scholarshipDescription) doc.scholarshipDescription = strip(doc.scholarshipDescription).slice(0, 2000);
  if (doc.city) doc.city = strip(doc.city).slice(0, 80);
  if (doc.country) doc.country = strip(doc.country).slice(0, 80);
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
  if (b.status !== undefined) {
    const st = String(b.status).toLowerCase();
    if (st === "draft") { b.status = "draft"; b.publishAt = null; }
    else if (st === "scheduled") {
      if (!b.publishAt) throw new Error("scheduled requires publishAt");
      const d = new Date(b.publishAt);
      if (isNaN(d.getTime())) throw new Error("invalid publishAt");
      const now = new Date();
      const max = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (d <= now || d > max) throw new Error("publishAt must be future within 30 days");
      b.publishAt = d;
      b.status = "scheduled";
    } else { b.status = "published"; b.publishAt = null; }
  }
  if (b.publishAt !== undefined && b.status !== "scheduled") {
    // if publishAt provided without scheduled status, handle
    if (b.publishAt) {
      const d = new Date(b.publishAt);
      if (!isNaN(d.getTime())) {
        const now = new Date();
        const max = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (d > now && d <= max) { b.publishAt = d; b.status = "scheduled"; }
        else b.publishAt = null;
      } else b.publishAt = null;
    } else b.publishAt = null;
  }
  if (b.showScheduledOnProfile !== undefined) b.showScheduledOnProfile = !!b.showScheduledOnProfile;
  const strip = (s) => String(s || "").replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>?/gm, "").trim();
  const cleanArr = (arr, limit = 20) => arr.map((s) => strip(String(s))).filter(Boolean).slice(0, limit);
  if (b.universityName) b.universityName = strip(b.universityName).slice(0, 120);
  if (b.scholarshipName) b.scholarshipName = strip(b.scholarshipName).slice(0, 200);
  if (b.scholarshipDescription) b.scholarshipDescription = strip(b.scholarshipDescription).slice(0, 2000);
  if (b.city) b.city = strip(b.city).slice(0, 80);
  if (b.country) b.country = strip(b.country).slice(0, 80);
  if (b.applicationFees !== undefined) b.applicationFees = Number(b.applicationFees);
  if (b.serviceCharge !== undefined) b.serviceCharge = Number(b.serviceCharge);
  if (b.stipend !== undefined && b.stipend !== "") b.stipend = Number(b.stipend);
  if (Array.isArray(b.eligibility)) b.eligibility = cleanArr(b.eligibility, 20);
  if (Array.isArray(b.benefits)) b.benefits = cleanArr(b.benefits, 20);
  if (Array.isArray(b.tags)) b.tags = cleanArr(b.tags, 20);
  if (Array.isArray(b.gallery)) b.gallery = b.gallery.map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
  if (Array.isArray(b.documents)) b.documents = cleanArr(b.documents, 20);
  if (Array.isArray(b.requirements)) b.requirements = cleanArr(b.requirements, 20);
  if (Array.isArray(b.highlights)) b.highlights = cleanArr(b.highlights, 10);
  if (Array.isArray(b.faqs)) b.faqs = b.faqs.slice(0, 10).map((f) => ({ q: strip(String(f.q || f.question || "")).slice(0, 200), a: strip(String(f.a || f.answer || "")).slice(0, 800) })).filter((f) => f.q && f.a);
  if (b.videoUrl !== undefined) b.videoUrl = b.videoUrl ? strip(String(b.videoUrl)).slice(0, 500) : null;
  if (b.videoPoster !== undefined) b.videoPoster = b.videoPoster ? strip(String(b.videoPoster)).slice(0, 500) : null;
  if (b.brochureUrl !== undefined) b.brochureUrl = b.brochureUrl ? strip(String(b.brochureUrl)).slice(0, 500) : null;
  if (b.mapUrl !== undefined) b.mapUrl = b.mapUrl ? strip(String(b.mapUrl)).slice(0, 500) : null;
  return b;
}

module.exports = { buildScholarshipFilter, buildScholarshipSort, normalizeScholarshipDoc, normalizeScholarshipPatch };
