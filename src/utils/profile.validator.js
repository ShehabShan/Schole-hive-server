function isValidUrl(str) {
  if (!str) return false;
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

function validateUrlField(val, maxLen, field, errors) {
  const s = String(val).trim();
  if (s.length === 0) return null;
  if (s.length > maxLen) errors.push(`${field} too long (max ${maxLen})`);
  else if (!isValidUrl(s)) errors.push(`${field} must be a valid http(s) URL`);
  return s.slice(0, maxLen);
}

function toArrayLimit(arr, limit) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s).trim()).filter(Boolean).slice(0, limit);
}

function validateProfilePatch(body) {
  const allowed = ["name", "photoURL", "phone", "bio", "city", "country", "skills", "coverPhoto", "orgName", "orgType", "orgCountry", "orgWebsite", "orgDescription","headline","socials","languages","interests","education","experience","certifications","achievements","gallery","videoIntro","preferences","orgFounded","orgAccreditation","orgStudentCount","orgFacultyCount","orgDepartments","orgPrograms","orgGallery","orgVideoUrl","orgBrochureUrl","orgMapUrl","orgHighlights"];
  const errors = [];
  const updates = {};
  for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k];

  if (updates.name !== undefined) {
    const n = String(updates.name).trim();
    if (n.length < 2 || n.length > 80) errors.push("name must be 2-80 characters");
    else updates.name = n;
  }
  if (updates.headline !== undefined) {
    updates.headline = String(updates.headline).trim().slice(0, 120) || null;
  }
  if (updates.photoURL !== undefined) {
    if (!updates.photoURL || String(updates.photoURL).trim() === "") updates.photoURL = null;
    else {
      const v = validateUrlField(updates.photoURL, 2000, "photoURL", errors);
      if (!errors.some(e=>e.includes("photoURL"))) updates.photoURL = v;
    }
  }
  if (updates.coverPhoto !== undefined) {
    if (!updates.coverPhoto || String(updates.coverPhoto).trim() === "") updates.coverPhoto = null;
    else {
      const v = validateUrlField(updates.coverPhoto, 2000, "coverPhoto", errors);
      if (!errors.some(e=>e.includes("coverPhoto"))) updates.coverPhoto = v;
    }
  }
  if (updates.videoIntro !== undefined) {
    if (!updates.videoIntro || String(updates.videoIntro).trim() === "") updates.videoIntro = null;
    else {
      const v = validateUrlField(updates.videoIntro, 500, "videoIntro", errors);
      if (!errors.some(e=>e.includes("videoIntro"))) updates.videoIntro = v;
    }
  }
  if (updates.phone !== undefined && updates.phone) {
    updates.phone = String(updates.phone).trim().slice(0, 30);
    if (updates.phone.length === 0) updates.phone = null;
  } else if (updates.phone !== undefined) updates.phone = null;

  if (updates.bio !== undefined) {
    if (!updates.bio || String(updates.bio).trim() === "") updates.bio = null;
    else {
      const b = String(updates.bio).trim();
      if (b.length > 600) errors.push("bio max 600 chars");
      else updates.bio = b;
    }
  }
  if (updates.city !== undefined) updates.city = String(updates.city).trim().slice(0, 80) || null;
  if (updates.country !== undefined) updates.country = String(updates.country).trim().slice(0, 80) || null;

  if (updates.skills !== undefined) {
    if (!Array.isArray(updates.skills)) errors.push("skills must be array");
    else updates.skills = updates.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
  }
  if (updates.socials !== undefined) {
    if (typeof updates.socials !== "object" || Array.isArray(updates.socials) || !updates.socials) errors.push("socials must be object");
    else {
      const s = updates.socials;
      const out = {};
      for (const k of ["linkedin","twitter","github","website"]) {
        const raw = s[k] ? String(s[k]).trim().slice(0,300) : null;
        if (raw) {
          if (!isValidUrl(raw)) errors.push(`socials.${k} must be a valid URL`);
          else out[k] = raw;
        } else out[k] = null;
      }
      if (!errors.some(e=>e.includes("socials."))) updates.socials = out;
    }
  }
  if (updates.languages !== undefined) {
    if (!Array.isArray(updates.languages)) errors.push("languages must be array");
    else updates.languages = updates.languages.slice(0,8).map(l=>({
      name: String(l.name||"").trim().slice(0,40),
      level: ["native","fluent","intermediate","basic"].includes(String(l.level||"").toLowerCase()) ? String(l.level).toLowerCase() : "intermediate",
    })).filter(l=>l.name);
  }
  if (updates.interests !== undefined) {
    if (!Array.isArray(updates.interests)) errors.push("interests must be array");
    else updates.interests = updates.interests.map(s=>String(s).trim()).filter(Boolean).slice(0,12);
  }
  if (updates.education !== undefined) {
    if (!Array.isArray(updates.education)) errors.push("education must be array");
    else updates.education = updates.education.slice(0,5).map(e=>({
      school: String(e.school||"").trim().slice(0,120),
      degree: String(e.degree||"").trim().slice(0,80),
      field: String(e.field||"").trim().slice(0,80),
      startYear: e.startYear ? Number(e.startYear) : null,
      endYear: e.endYear ? Number(e.endYear) : null,
      grade: String(e.grade||"").trim().slice(0,40) || null,
      description: String(e.description||"").trim().slice(0,400) || null,
      logoUrl: e.logoUrl ? String(e.logoUrl).trim().slice(0,500) || null : null,
    })).filter(e=>e.school);
  }
  if (updates.experience !== undefined) {
    if (!Array.isArray(updates.experience)) errors.push("experience must be array");
    else updates.experience = updates.experience.slice(0,6).map(e=>({
      title: String(e.title||"").trim().slice(0,120),
      org: String(e.org||"").trim().slice(0,120),
      location: String(e.location||"").trim().slice(0,80) || null,
      startDate: e.startDate ? String(e.startDate).slice(0,20) : null,
      endDate: e.endDate ? String(e.endDate).slice(0,20) : null,
      current: Boolean(e.current),
      description: String(e.description||"").trim().slice(0,500) || null,
    })).filter(e=>e.title && e.org);
  }
  if (updates.certifications !== undefined) {
    if (!Array.isArray(updates.certifications)) errors.push("certifications must be array");
    else updates.certifications = updates.certifications.slice(0,8).map(c=>({
      name: String(c.name||"").trim().slice(0,120),
      issuer: String(c.issuer||"").trim().slice(0,120),
      issueDate: c.issueDate ? String(c.issueDate).slice(0,20) : null,
      url: c.url ? String(c.url).trim().slice(0,500) || null : null,
      credentialId: String(c.credentialId||"").trim().slice(0,100) || null,
    })).filter(c=>c.name);
  }
  if (updates.achievements !== undefined) {
    if (!Array.isArray(updates.achievements)) errors.push("achievements must be array");
    else updates.achievements = updates.achievements.slice(0,10).map(a=>({
      title: String(a.title||"").trim().slice(0,120),
      date: a.date ? String(a.date).slice(0,20) : null,
      description: String(a.description||"").trim().slice(0,400) || null,
      url: a.url ? String(a.url).trim().slice(0,500) || null : null,
    })).filter(a=>a.title);
  }
  if (updates.gallery !== undefined) {
    if (!Array.isArray(updates.gallery)) errors.push("gallery must be array");
    else {
      const arr = updates.gallery.map(s=>String(s).trim()).filter(Boolean).slice(0,6).map(s=>s.slice(0,500));
      for (const u of arr) if (!isValidUrl(u)) errors.push("gallery URLs must be valid http(s) URLs");
      if (!errors.some(e=>e.includes("gallery"))) updates.gallery = arr;
    }
  }
  if (updates.preferences !== undefined) {
    if (typeof updates.preferences !== "object" || Array.isArray(updates.preferences) || !updates.preferences) errors.push("preferences must be object");
    else {
      const p = updates.preferences;
      const cur = {};
      if (p.visibility !== undefined) {
        if (!["public","connections","private"].includes(String(p.visibility))) errors.push("visibility invalid");
        else cur.visibility = String(p.visibility);
      }
      if (p.showStatsOnPublic !== undefined) cur.showStatsOnPublic = Boolean(p.showStatsOnPublic);
      if (p.showScheduledOnProfile !== undefined) cur.showScheduledOnProfile = Boolean(p.showScheduledOnProfile);
      if (p.showFollowersOnPublic !== undefined) cur.showFollowersOnPublic = Boolean(p.showFollowersOnPublic);
      if (p.emailNotifications !== undefined) cur.emailNotifications = Boolean(p.emailNotifications);
      updates._preferencesPatch = cur;
    }
  }
  if (updates.orgName !== undefined) updates.orgName = String(updates.orgName).trim().slice(0, 120) || null;
  if (updates.orgType !== undefined) {
    updates.orgType = ["university", "college", "school"].includes(String(updates.orgType).toLowerCase())
      ? String(updates.orgType).toLowerCase()
      : "university";
  }
  if (updates.orgCountry !== undefined) updates.orgCountry = String(updates.orgCountry).trim().slice(0, 80) || null;
  if (updates.orgWebsite !== undefined) {
    if (!updates.orgWebsite || String(updates.orgWebsite).trim() === "") updates.orgWebsite = null;
    else {
      const v = validateUrlField(updates.orgWebsite, 300, "orgWebsite", errors);
      if (!errors.some(e=>e.includes("orgWebsite"))) updates.orgWebsite = v;
    }
  }
  if (updates.orgDescription !== undefined) updates.orgDescription = String(updates.orgDescription).trim().slice(0, 2000) || null;
  if (updates.orgFounded !== undefined) updates.orgFounded = updates.orgFounded ? Number(updates.orgFounded) : null;
  if (updates.orgAccreditation !== undefined) updates.orgAccreditation = String(updates.orgAccreditation).trim().slice(0,120) || null;
  if (updates.orgStudentCount !== undefined) updates.orgStudentCount = updates.orgStudentCount ? Number(updates.orgStudentCount) : null;
  if (updates.orgFacultyCount !== undefined) updates.orgFacultyCount = updates.orgFacultyCount ? Number(updates.orgFacultyCount) : null;
  if (updates.orgDepartments !== undefined) {
    if (!Array.isArray(updates.orgDepartments)) errors.push("orgDepartments must be array");
    else updates.orgDepartments = updates.orgDepartments.map(s=>String(s).trim()).filter(Boolean).slice(0,20);
  }
  if (updates.orgPrograms !== undefined) {
    if (!Array.isArray(updates.orgPrograms)) errors.push("orgPrograms must be array");
    else updates.orgPrograms = updates.orgPrograms.slice(0,20).map(p=>({
      name: String(p.name||"").trim().slice(0,120),
      level: String(p.level||"").trim().slice(0,40) || null,
      duration: String(p.duration||"").trim().slice(0,40) || null,
      seats: p.seats ? Number(p.seats) : null,
    })).filter(p=>p.name);
  }
  if (updates.orgGallery !== undefined) {
    if (!Array.isArray(updates.orgGallery)) errors.push("orgGallery must be array");
    else {
      const arr = updates.orgGallery.map(s=>String(s).trim()).filter(Boolean).slice(0,6).map(s=>s.slice(0,500));
      for (const u of arr) if (!isValidUrl(u)) errors.push("orgGallery URLs must be valid URLs");
      if (!errors.some(e=>e.includes("orgGallery"))) updates.orgGallery = arr;
    }
  }
  if (updates.orgVideoUrl !== undefined) {
    if (!updates.orgVideoUrl || String(updates.orgVideoUrl).trim() === "") updates.orgVideoUrl = null;
    else {
      const v = validateUrlField(updates.orgVideoUrl, 500, "orgVideoUrl", errors);
      if (!errors.some(e=>e.includes("orgVideoUrl"))) updates.orgVideoUrl = v;
    }
  }
  if (updates.orgBrochureUrl !== undefined) {
    if (!updates.orgBrochureUrl || String(updates.orgBrochureUrl).trim() === "") updates.orgBrochureUrl = null;
    else {
      const v = validateUrlField(updates.orgBrochureUrl, 500, "orgBrochureUrl", errors);
      if (!errors.some(e=>e.includes("orgBrochureUrl"))) updates.orgBrochureUrl = v;
    }
  }
  if (updates.orgMapUrl !== undefined) {
    if (!updates.orgMapUrl || String(updates.orgMapUrl).trim() === "") updates.orgMapUrl = null;
    else {
      const v = validateUrlField(updates.orgMapUrl, 500, "orgMapUrl", errors);
      if (!errors.some(e=>e.includes("orgMapUrl"))) updates.orgMapUrl = v;
    }
  }
  if (updates.orgHighlights !== undefined) {
    if (!Array.isArray(updates.orgHighlights)) errors.push("orgHighlights must be array");
    else updates.orgHighlights = updates.orgHighlights.map(s=>String(s).trim()).filter(Boolean).slice(0,10);
  }

  return { valid: errors.length === 0, errors, data: updates };
}

module.exports = { validateProfilePatch, isValidUrl };
