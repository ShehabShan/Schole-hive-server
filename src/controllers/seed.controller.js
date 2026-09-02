const { getCollections } = require("../config/db");
const { recalcScholarshipRating } = require("../services/review.service");

// Seed data definition
const INSTITUTIONS = [
  {
    name: "Oxford International Office",
    email: "admissions@oxford-inst.edu",
    role: "institution",
    status: "approved",
    orgName: "University of Oxford",
    orgType: "university",
    orgCountry: "United Kingdom",
    orgWebsite: "https://www.ox.ac.uk",
    orgDescription: "Premier research university in Oxford, England.",
    photoURL: "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=300&q=80",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "MIT Scholarship Board",
    email: "grants@mit-inst.edu",
    role: "institution",
    status: "approved",
    orgName: "Massachusetts Institute of Technology",
    orgType: "university",
    orgCountry: "United States",
    orgWebsite: "https://www.mit.edu",
    orgDescription: "World leader in science, technology, and innovation.",
    photoURL: "https://images.unsplash.com/photo-1562774053-701939374585?w=300&q=80",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "ETH Zurich Global Fellowships",
    email: "fellowships@ethz-inst.ch",
    role: "institution",
    status: "approved",
    orgName: "ETH Zurich",
    orgType: "university",
    orgCountry: "Switzerland",
    orgWebsite: "https://ethz.ch",
    orgDescription: "STEM research university in Zurich, Switzerland.",
    photoURL: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=300&q=80",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "University of Tokyo Admissions",
    email: "scholarships@u-tokyo-inst.ac.jp",
    role: "institution",
    status: "approved",
    orgName: "The University of Tokyo",
    orgType: "university",
    orgCountry: "Japan",
    orgWebsite: "https://www.u-tokyo.ac.jp",
    orgDescription: "Japan's flagship research university.",
    photoURL: "https://images.unsplash.com/photo-1526888935184-a82d2a4b7e67?w=300&q=80",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "University of Melbourne Financial Aid",
    email: "finaid@unimelb-inst.edu.au",
    role: "institution",
    status: "approved",
    orgName: "The University of Melbourne",
    orgType: "university",
    orgCountry: "Australia",
    orgWebsite: "https://www.unimelb.edu.au",
    orgDescription: "Australia's top research university located in Melbourne.",
    photoURL: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=300&q=80",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const SCHOLARSHIPS_DATA = [
  {
    universityName: "University of Oxford",
    scholarshipCategory: "Full Fund",
    degree: "Masters",
    subjectName: "Computer Science & AI",
    country: "United Kingdom",
    city: "Oxford",
    universityWorldrank: 1,
    universityImage: "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=800&q=80",
    applicationFees: 75,
    serviceCharge: 20,
    stipend: 18500,
    currency: "GBP",
    applicationDeadline: "2026-11-30",
    scholarshipDescription: "The Clarendon Fund offers full scholarships covering tuition and living stipend for outstanding graduate scholars worldwide at the University of Oxford.",
    eligibility: ["Bachelor degree with First Class honors", "GPA 3.8+", "IELTS 7.5+ or TOEFL 100+"],
    requirements: ["Academic transcripts", "3 Letters of Recommendation", "Statement of Purpose"],
    benefits: ["100% Tuition covered", "Annual living stipend of £18,500", "Access to Oxford Scholars Network"],
    highlights: ["Fully Funded", "Global Prestige", "Mentorship Included"],
    documents: ["Transcript", "Statement of Purpose", "Recommendation Letter", "IELTS/TOEFL", "CV"],
    postDate: "2026-09-01",
    rating: 5,
    reviewsCount: 0,
    creatorEmail: "admissions@oxford-inst.edu",
  },
  {
    universityName: "Massachusetts Institute of Technology",
    scholarshipCategory: "Full Fund",
    degree: "PhD",
    subjectName: "Robotics & Quantum Computing",
    country: "United States",
    city: "Cambridge, MA",
    universityWorldrank: 2,
    universityImage: "https://images.unsplash.com/photo-1562774053-701939374585?w=800&q=80",
    applicationFees: 95,
    serviceCharge: 25,
    stipend: 42000,
    currency: "USD",
    applicationDeadline: "2026-12-15",
    scholarshipDescription: "MIT Presidential Fellowships award full funding including tuition coverage, health insurance, and annual research stipends to exceptional incoming doctoral candidates.",
    eligibility: ["Strong STEM background", "GRE / Research Publications", "GPA 3.7+"],
    requirements: ["3 Letters of Recommendation", "Research Proposal", "GRE Scores"],
    benefits: ["Full Tuition & Health Insurance", "$42,000 annual stipend", "Lab funding & conference budget"],
    highlights: ["Top Research Lab Access", "Full Medical Coverage", "Industry Sponsorship"],
    documents: ["Transcript", "Research Proposal", "3 Recommendation Letters", "GRE Scorecard", "CV"],
    postDate: "2026-09-01",
    rating: 5,
    reviewsCount: 0,
    creatorEmail: "grants@mit-inst.edu",
  },
  {
    universityName: "ETH Zurich",
    scholarshipCategory: "Partial Fund",
    degree: "Masters",
    subjectName: "Data Science & Engineering",
    country: "Switzerland",
    city: "Zurich",
    universityWorldrank: 7,
    universityImage: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80",
    applicationFees: 50,
    serviceCharge: 15,
    stipend: 24000,
    currency: "CHF",
    applicationDeadline: "2026-10-31",
    scholarshipDescription: "The Excellence Scholarship & Opportunity Programme (ESOP) supports students with outstanding performance pursuing a Master's degree at ETH Zurich.",
    eligibility: ["Bachelor degree in top 10% of class", "GPA 3.6+", "Fluency in English"],
    requirements: ["Pre-proposal for Master thesis", "2 Academic references", "CV"],
    benefits: ["Full waiver of tuition fees", "CHF 12,000 per semester for living costs"],
    highlights: ["Living Stipend", "European Tech Hub", "Thesis Pre-Approval"],
    documents: ["Transcript", "Master Thesis Pre-proposal", "CV", "2 Reference Letters"],
    postDate: "2026-09-01",
    rating: 5,
    reviewsCount: 0,
    creatorEmail: "fellowships@ethz-inst.ch",
  },
  {
    universityName: "The University of Tokyo",
    scholarshipCategory: "Full Fund",
    degree: "Bachelor",
    subjectName: "Environmental Science & Sustainability",
    country: "Japan",
    city: "Tokyo",
    universityWorldrank: 28,
    universityImage: "https://images.unsplash.com/photo-1526888935184-a82d2a4b7e67?w=800&q=80",
    applicationFees: 30,
    serviceCharge: 10,
    stipend: 1440000,
    currency: "JPY",
    applicationDeadline: "2026-11-15",
    scholarshipDescription: "MEXT & UTokyo Global Science Course Scholarship covers full admission, tuition, and a monthly stipend for international undergraduate students in science fields.",
    eligibility: ["High school graduate", "Strong Mathematics & Science foundation", "English proficiency"],
    requirements: ["High school transcripts", "SAT/ACT or National Exam scores", "Personal Statement"],
    benefits: ["Full admission & tuition coverage", "JPY 120,000 monthly living allowance", "Japanese language assistance"],
    highlights: ["Undergraduate Full Fund", "Housing Support", "Tokyo Cultural Immersion"],
    documents: ["High School Transcript", "Personal Statement", "Recommendation Letter", "Language Certificate"],
    postDate: "2026-09-01",
    rating: 5,
    reviewsCount: 0,
    creatorEmail: "scholarships@u-tokyo-inst.ac.jp",
  },
  {
    universityName: "The University of Melbourne",
    scholarshipCategory: "Full Fund",
    degree: "Masters",
    subjectName: "Biomedical & Health Sciences",
    country: "Australia",
    city: "Melbourne",
    universityWorldrank: 14,
    universityImage: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&q=80",
    applicationFees: 60,
    serviceCharge: 15,
    stipend: 34500,
    currency: "AUD",
    applicationDeadline: "2026-10-15",
    scholarshipDescription: "Melbourne International Graduate Scholarship awards high-achieving international students undertaking research or coursework master degrees.",
    eligibility: ["Completed undergraduate degree with WAM 80%+", "Relevant background in health science"],
    requirements: ["Academic transcripts", "English language test score", "2 Referee reports"],
    benefits: ["100% Fee remission", "AUD $34,500 per year stipend", "Overseas Student Health Cover (OSHC)"],
    highlights: ["100% Fee Remission", "Health Cover Included", "Top Australian Uni"],
    documents: ["Transcript", "English Test Results", "Referee Reports", "CV"],
    postDate: "2026-09-01",
    rating: 5,
    reviewsCount: 0,
    creatorEmail: "finaid@unimelb-inst.edu.au",
  },
];

const REVIEWS_POOL = [
  {
    reviewer_name: "Sarah Jenkins",
    reviewer_email: "sarah.j@example.com",
    reviewer_image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80",
    rating: 5,
    comment: "An incredible opportunity! The application process was straightforward and the monthly stipend allows me to focus 100% on my research.",
    status: "approved",
  },
  {
    reviewer_name: "Marcus Vance",
    reviewer_email: "marcus.v@example.com",
    reviewer_image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80",
    rating: 5,
    comment: "Top-tier lab facilities and incredible faculty mentorship. Receiving full tuition coverage made studying abroad stress-free.",
    status: "approved",
  },
  {
    reviewer_name: "Elena Rostova",
    reviewer_email: "elena.r@example.com",
    reviewer_image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80",
    rating: 4,
    comment: "Great fellowship program. Living costs in the city are high, but the stipend covers all essential expenses nicely.",
    status: "approved",
  },
  {
    reviewer_name: "Kenji Sato",
    reviewer_email: "kenji.s@example.com",
    reviewer_image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80",
    rating: 5,
    comment: "Extremely well organized program. The university housing assistance and research funding support exceeded my expectations.",
    status: "approved",
  },
  {
    reviewer_name: "Amina Al-Mansoor",
    reviewer_email: "amina.m@example.com",
    reviewer_image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&q=80",
    rating: 5,
    comment: "Life changing experience! The international student network is super supportive and the university administration was very helpful.",
    status: "approved",
  },
  {
    reviewer_name: "David Chen",
    reviewer_email: "david.c@example.com",
    reviewer_image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&q=80",
    rating: 4,
    comment: "Solid scholarship structure. Make sure to prepare your SOP early as competition is quite intense.",
    status: "approved",
  },
  {
    reviewer_name: "Chloe Dubois",
    reviewer_email: "chloe.d@example.com",
    reviewer_image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&q=80",
    rating: 5,
    comment: "The global network of scholars is amazing. Funding was disbursed right on time every semester.",
    status: "approved",
  },
  {
    reviewer_name: "Carlos Mendez",
    reviewer_email: "carlos.m@example.com",
    reviewer_image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&q=80",
    rating: 5,
    comment: "World class academic standards and comprehensive health cover included. Highly recommended to prospective applicants!",
    status: "approved",
  },
  {
    reviewer_name: "Hannah Schmidt",
    reviewer_email: "hannah.s@example.com",
    reviewer_image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&q=80",
    rating: 4,
    comment: "Super smooth onboarding process. The academic department is world renowned for innovation.",
    status: "approved",
  },
  {
    reviewer_name: "Rajesh Kumar",
    reviewer_email: "rajesh.k@example.com",
    reviewer_image: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&q=80",
    rating: 5,
    comment: "Generous research grants and full fee waivers. Applying through School Hive was seamless!",
    status: "approved",
  },
];

async function seedDatabase(req, res) {
  const { users, scholership, reviews } = getCollections();

  let createdInstitutionsCount = 0;
  for (const inst of INSTITUTIONS) {
    const existing = await users.findOne({ email: inst.email });
    if (!existing) {
      await users.insertOne(inst);
      createdInstitutionsCount++;
    } else {
      await users.updateOne(
        { email: inst.email },
        { $set: { role: "institution", status: "approved", orgName: inst.orgName } }
      );
    }
  }

  let createdScholarships = [];
  for (const item of SCHOLARSHIPS_DATA) {
    const existing = await scholership.findOne({
      universityName: item.universityName,
      subjectName: item.subjectName,
    });
    if (!existing) {
      const result = await scholership.insertOne({
        ...item,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdScholarships.push({ id: result.insertedId, name: item.universityName });
    } else {
      createdScholarships.push({ id: existing._id, name: existing.universityName });
    }
  }

  // Assign 10 reviews across the 5 scholarships (2 reviews per scholarship)
  let createdReviewsCount = 0;
  let reviewIdx = 0;
  for (const s of createdScholarships) {
    for (let i = 0; i < 2; i++) {
      if (reviewIdx >= REVIEWS_POOL.length) break;
      const revData = REVIEWS_POOL[reviewIdx];
      reviewIdx++;

      const existingReview = await reviews.findOne({
        reviewer_email: revData.reviewer_email,
        scholarShip_id: String(s.id),
      });

      if (!existingReview) {
        await reviews.insertOne({
          scholarShip_id: String(s.id),
          scholarshipName: s.name,
          universityName: s.name,
          reviewer_name: revData.reviewer_name,
          reviewer_email: revData.reviewer_email,
          reviewer_image: revData.reviewer_image,
          rating: revData.rating,
          comment: revData.comment,
          status: revData.status,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        createdReviewsCount++;
      }
      await recalcScholarshipRating(String(s.id));
    }
  }

  res.status(200).json({
    message: "Database seeded successfully!",
    institutions: createdInstitutionsCount,
    scholarships: createdScholarships.length,
    reviews: createdReviewsCount,
  });
}

module.exports = { seedDatabase };
