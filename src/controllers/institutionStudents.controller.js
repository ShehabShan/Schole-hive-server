const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");

async function assertInstitutionAccess(req, institutionEmail) {
  const email = String(institutionEmail).toLowerCase();
  const auth = req.authUser;
  if (!auth) throw { status: 401, message: "unauthorized" };
  if (auth.role === "superadmin" || auth.role === "admin") return true;
  if (auth.role === "institution" && String(auth.email).toLowerCase() === email && auth.status === "approved") return true;
  throw { status: 403, message: "forbidden: only owning approved institution or admin" };
}

async function addStudent(req, res) {
  const institutionEmail = String(req.params.email || "").toLowerCase().trim();
  if (!institutionEmail.includes("@")) return res.status(400).json({ message: "valid institution email required" });
  try { await assertInstitutionAccess(req, institutionEmail); } catch (e) { return res.status(e.status || 403).json({ message: e.message }); }
  const { studentName, studentEmail, department, program, year, rollId, status } = req.body;
  if (!studentName || !studentEmail) return res.status(400).json({ message: "studentName and studentEmail required" });
  const se = String(studentEmail).toLowerCase().trim();
  if (!se.includes("@")) return res.status(400).json({ message: "valid studentEmail required" });
  const { institutionStudents } = getCollections();
  const exists = await institutionStudents.findOne({ institutionEmail, studentEmail: se });
  if (exists) return res.status(409).json({ message: "student already exists for this institution" });
  const doc = {
    institutionEmail,
    studentName: String(studentName).trim().slice(0,120),
    studentEmail: se,
    department: department ? String(department).trim().slice(0,80) : null,
    program: program ? String(program).trim().slice(0,80) : null,
    year: year ? String(year).trim().slice(0,20) : null,
    rollId: rollId ? String(rollId).trim().slice(0,40) : null,
    status: ["active","invited","alumni"].includes(String(status)) ? String(status) : "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    addedBy: req.decoded.email,
  };
  const result = await institutionStudents.insertOne(doc);
  res.status(201).json({ message: "student added", data: { insertedId: result.insertedId, doc } });
}

async function bulkAddStudents(req, res) {
  const institutionEmail = String(req.params.email || "").toLowerCase().trim();
  if (!institutionEmail.includes("@")) return res.status(400).json({ message: "valid institution email required" });
  try { await assertInstitutionAccess(req, institutionEmail); } catch (e) { return res.status(e.status || 403).json({ message: e.message }); }
  const students = req.body.students;
  if (!Array.isArray(students) || students.length === 0) return res.status(400).json({ message: "students array required" });
  if (students.length > 50) return res.status(400).json({ message: "max 50 students per bulk request" });
  const { institutionStudents } = getCollections();
  let inserted = 0, skipped = 0, errors = [];
  for (const s of students) {
    const se = String(s.studentEmail || s.email || "").toLowerCase().trim();
    const sn = String(s.studentName || s.name || "").trim();
    if (!se || !sn || !se.includes("@")) { skipped++; errors.push({ email: se, reason: "invalid name/email" }); continue; }
    const exists = await institutionStudents.findOne({ institutionEmail, studentEmail: se });
    if (exists) { skipped++; continue; }
    const doc = {
      institutionEmail,
      studentName: sn.slice(0,120),
      studentEmail: se,
      department: s.department ? String(s.department).trim().slice(0,80) : null,
      program: s.program ? String(s.program).trim().slice(0,80) : null,
      year: s.year ? String(s.year).trim().slice(0,20) : null,
      rollId: s.rollId ? String(s.rollId).trim().slice(0,40) : null,
      status: ["active","invited","alumni"].includes(String(s.status)) ? String(s.status) : "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      addedBy: req.decoded.email,
    };
    await institutionStudents.insertOne(doc);
    inserted++;
  }
  res.json({ message: "bulk complete", data: { inserted, skipped, errors } });
}

async function listStudents(req, res) {
  const institutionEmail = String(req.params.email || "").toLowerCase().trim();
  if (!institutionEmail.includes("@")) return res.status(400).json({ message: "valid institution email required" });
  // allow institution owner OR any authenticated user to view? restrict to owner/admin for privacy, but list is for portal owner
  try { await assertInstitutionAccess(req, institutionEmail); } catch (e) { return res.status(e.status || 403).json({ message: e.message }); }
  const q = String(req.query.q || "").trim();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const filter = { institutionEmail };
  if (q) {
    filter.$or = [
      { studentName: { $regex: q, $options: "i" } },
      { studentEmail: { $regex: q, $options: "i" } },
      { department: { $regex: q, $options: "i" } },
    ];
  }
  if (req.query.department) filter.department = String(req.query.department).trim();
  if (req.query.status && ["active","invited","alumni"].includes(String(req.query.status))) filter.status = String(req.query.status);
  const { institutionStudents } = getCollections();
  const total = await institutionStudents.countDocuments(filter);
  const data = await institutionStudents.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).toArray();
  res.json({ message: "students fetched", data, total, page, totalPages: Math.ceil(total/limit) });
}

async function updateStudent(req, res) {
  const institutionEmail = String(req.params.email || "").toLowerCase().trim();
  const id = req.params.id;
  try { await assertInstitutionAccess(req, institutionEmail); } catch (e) { return res.status(e.status || 403).json({ message: e.message }); }
  let oid;
  try { oid = new ObjectId(id); } catch { return res.status(400).json({ message: "invalid id" }); }
  const { institutionStudents } = getCollections();
  const existing = await institutionStudents.findOne({ _id: oid, institutionEmail });
  if (!existing) return res.status(404).json({ message: "student not found" });
  const updates = {};
  for (const k of ["studentName","department","program","year","rollId","status"]) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  if (updates.studentName !== undefined) {
    const v = String(updates.studentName).trim();
    if (v.length < 2) return res.status(400).json({ message: "studentName 2+ chars" });
    updates.studentName = v.slice(0,120);
  }
  if (updates.department !== undefined) updates.department = String(updates.department).trim().slice(0,80) || null;
  if (updates.program !== undefined) updates.program = String(updates.program).trim().slice(0,80) || null;
  if (updates.year !== undefined) updates.year = String(updates.year).trim().slice(0,20) || null;
  if (updates.rollId !== undefined) updates.rollId = String(updates.rollId).trim().slice(0,40) || null;
  if (updates.status !== undefined) {
    if (!["active","invited","alumni"].includes(String(updates.status))) return res.status(400).json({ message: "status invalid" });
    updates.status = String(updates.status);
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ message: "nothing to update" });
  updates.updatedAt = new Date();
  const result = await institutionStudents.updateOne({ _id: oid }, { $set: updates });
  const updated = await institutionStudents.findOne({ _id: oid });
  res.json({ message: "student updated", data: result, student: updated });
}

async function deleteStudent(req, res) {
  const institutionEmail = String(req.params.email || "").toLowerCase().trim();
  const id = req.params.id;
  try { await assertInstitutionAccess(req, institutionEmail); } catch (e) { return res.status(e.status || 403).json({ message: e.message }); }
  let oid;
  try { oid = new ObjectId(id); } catch { return res.status(400).json({ message: "invalid id" }); }
  const { institutionStudents } = getCollections();
  const result = await institutionStudents.deleteOne({ _id: oid, institutionEmail });
  if (result.deletedCount === 0) return res.status(404).json({ message: "student not found" });
  res.json({ message: "student deleted", data: result });
}

module.exports = { addStudent, bulkAddStudents, listStudents, updateStudent, deleteStudent };
