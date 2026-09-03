// Q&A Forum V1 constants — Task 1
// Category enum (spec 1.2, Q5 resolved — 7 fixed slugs)
const QUESTION_CATEGORIES = [
  "scholarships-financial-aid",
  "visa-application-process",
  "university-program-selection",
  "test-prep",
  "campus-life-culture-shock",
  "careers-internships-abroad",
  "country-specific",
];

// Controlled tag vocab starter list (Q4 resolved — ~45 slugs, lowercase-hyphenated)
// Grouped for reference; flat array is the source of truth for autocomplete.
const QUESTION_TAGS = [
  // Tests
  "ielts", "toefl", "pte", "duolingo-english-test", "gre", "gmat", "sat", "act",
  // Destination countries
  "canada", "usa", "uk", "germany", "australia", "netherlands", "ireland",
  "new-zealand", "sweden", "japan", "south-korea", "malaysia",
  // Home countries/boards
  "bangladesh", "india", "pakistan", "nepal", "sri-lanka", "cbse", "icse",
  "national-curriculum-bd", "a-level", "o-level",
  // Study level
  "bachelors", "masters", "phd", "diploma", "foundation-year",
  // Funding
  "scholarship", "fully-funded", "partial-funding", "tuition-waiver", "assistantship",
  // Visa/process
  "visa", "student-visa", "i-20", "cas-letter", "blocked-account", "biometrics",
  "embassy-interview", "offer-letter", "conditional-offer",
  // Application docs
  "sop", "lor", "cv-resume", "gpa-conversion", "backlogs", "gap-year",
  // After arrival
  "part-time-work", "opt-cpt", "co-op", "accommodation", "culture-shock",
];

// Language enum (spec 1.1, Q8 resolved)
const QUESTION_LANGUAGES = ["english", "bengali", "hindi", "mixed"];

// Study level values also appear as context.studyLevel
const STUDY_LEVELS = ["bachelors", "masters", "phd", "diploma", "foundation-year"];

// Helper for display label (e.g. "ielts" -> "IELTS", "duolingo-english-test" -> "Duolingo English Test")
function tagLabel(slug) {
  const acronyms = new Set(["ielts", "toefl", "pte", "gre", "gmat", "sat", "act", "sop", "lor"]);
  if (acronyms.has(slug)) return slug.toUpperCase();
  if (slug === "duolingo-english-test") return "Duolingo English Test";
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

module.exports = {
  QUESTION_CATEGORIES,
  QUESTION_TAGS,
  QUESTION_LANGUAGES,
  STUDY_LEVELS,
  tagLabel,
};
