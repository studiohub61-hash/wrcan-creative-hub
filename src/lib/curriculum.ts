import type { Tables } from "@/integrations/supabase/types";

type Module = Tables<"training_modules">;

export type Lesson = {
  title: string;
  body: string[];
  takeaways: string[];
};

export type QuizQuestion = {
  q: string;
  options: string[];
  answer: number;
};

/** Deterministic shuffle so the same module always renders the same paper. */
function seeded(id: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return Math.abs(h % 1000) / 1000;
  };
}

function place(options: string[], correct: string, rnd: () => number): { options: string[]; answer: number } {
  const idx = Math.floor(rnd() * options.length) % options.length;
  const rest = options.filter((o) => o !== correct);
  const out = [...rest];
  out.splice(idx, 0, correct);
  return { options: out.slice(0, 4), answer: out.indexOf(correct) };
}

export function buildLessons(mod: Module): Lesson[] {
  const tags = (mod.tags ?? []).filter(Boolean);
  const skillLine = tags.length ? tags.join(", ") : mod.category;
  const body = mod.accrediting_body ?? mod.provider;

  return [
    {
      title: "1 · Orientation & purpose",
      body: [
        mod.description,
        `${mod.title} is delivered by ${mod.provider}${
          mod.accrediting_body ? ` and quality assured by ${mod.accrediting_body}` : ""
        }. The programme runs for ${mod.duration_hours} notional hours${
          mod.credits ? ` and carries ${mod.credits} credits` : ""
        }${mod.nqf_level ? ` at NQF Level ${mod.nqf_level}` : ""}.`,
        `Learners between ${mod.min_age} and ${mod.max_age} years old may enrol. The recommended entry requirement is ${
          mod.required_qualification ?? "no formal qualification"
        }.`,
      ],
      takeaways: [
        `Provider: ${mod.provider}`,
        `Quality assurance: ${body}`,
        `Notional hours: ${mod.duration_hours}`,
      ],
    },
    {
      title: "2 · Core knowledge",
      body: [
        `This unit builds the underpinning knowledge for ${mod.category.toLowerCase()} work in South Africa: relevant legislation, workplace standards, health and safety obligations, and the professional conduct expected on site.`,
        `You will work through the key competencies of this programme — ${skillLine} — with worked South African examples drawn from municipal, retail, hospitality and community settings.`,
        "Study tip: capture short notes against each competency. Those notes become the evidence you attach to your portfolio in Lesson 4.",
      ],
      takeaways: [
        `Competencies covered: ${skillLine}`,
        "Legislation, safety and professional conduct",
        "Notes now become portfolio evidence later",
      ],
    },
    {
      title: "3 · Practical application",
      body: [
        `Apply the theory to a real task. Choose a workplace, community project or simulated environment and carry out one full ${mod.category.toLowerCase()} activity from planning to hand-over.`,
        "Record what you planned, what you did, what went wrong, and how you corrected it. Assessors score reflection as highly as execution.",
        "Where the activity involves other people, note the communication and consent steps you followed — this is where most learners lose marks.",
      ],
      takeaways: [
        "Complete one end-to-end practical task",
        "Document planning, execution and correction",
        "Show communication and consent steps",
      ],
    },
    {
      title: "4 · Portfolio of evidence",
      body: [
        `${body} requires a Portfolio of Evidence (PoE) before a certificate is issued. Your PoE contains: a signed learner declaration, your activity notes, photographic or written proof of the practical task, and this module's assessment result.`,
        "Keep every document dated and legible. Upload your CV and supporting documents on your WRCAN profile so recruiters can verify your credentials instantly.",
        "WRCAN stores your assessment result and issues a numbered certificate automatically once you pass.",
      ],
      takeaways: [
        "PoE = declaration + notes + proof + result",
        "Date and label every document",
        "WRCAN issues the numbered certificate on a pass",
      ],
    },
    {
      title: "5 · Assessment readiness",
      body: [
        "The final assessment is a short multiple-choice paper covering everything above. The pass mark is 60%.",
        "You may retake the paper as often as you need; your highest score is the one recorded on the certificate.",
        "Once you pass, your certificate appears immediately under Certificates and can be downloaded or printed as an A4 landscape document.",
      ],
      takeaways: ["Pass mark: 60%", "Unlimited retakes", "Certificate issued instantly on a pass"],
    },
  ];
}

export function buildQuiz(mod: Module): QuizQuestion[] {
  const rnd = seeded(mod.id);
  const qa = mod.accrediting_body ?? mod.provider;
  const tags = (mod.tags ?? []).filter(Boolean);
  const firstTag = tags[0] ?? mod.category;

  const questions: QuizQuestion[] = [
    {
      q: `Who delivers the ${mod.title} programme?`,
      ...place(
        [mod.provider, "The South African Revenue Service", "The learner's employer", "Any private college"],
        mod.provider,
        rnd,
      ),
    },
    {
      q: "Which body provides the quality assurance for this programme?",
      ...place([qa, "The local ward councillor", "The learner", "No body is required"], qa, rnd),
    },
    {
      q: "How many notional hours does this programme carry?",
      ...place(
        [
          `${mod.duration_hours} hours`,
          `${mod.duration_hours + 15} hours`,
          `${Math.max(2, mod.duration_hours - 10)} hours`,
          "There is no set duration",
        ],
        `${mod.duration_hours} hours`,
        rnd,
      ),
    },
    {
      q: "Which of the following is a core competency of this module?",
      ...place(
        [firstTag, "Aircraft maintenance", "Deep-sea navigation", "Nuclear plant operation"],
        firstTag,
        rnd,
      ),
    },
    {
      q: "What must a Portfolio of Evidence contain?",
      ...place(
        [
          "A signed declaration, activity notes, proof of the practical task and the assessment result",
          "Only the learner's ID copy",
          "A letter from a friend",
          "Nothing — the certificate is automatic",
        ],
        "A signed declaration, activity notes, proof of the practical task and the assessment result",
        rnd,
      ),
    },
    {
      q: "What is the minimum age to enrol on this programme?",
      ...place(
        [`${mod.min_age} years`, `${mod.min_age + 4} years`, `${Math.max(14, mod.min_age - 3)} years`, "No age limit"],
        `${mod.min_age} years`,
        rnd,
      ),
    },
    {
      q: "During the practical unit, what do assessors score just as highly as execution?",
      ...place(
        [
          "Your reflection on what went wrong and how you corrected it",
          "The speed at which you finished",
          "The cost of the materials used",
          "The number of people watching",
        ],
        "Your reflection on what went wrong and how you corrected it",
        rnd,
      ),
    },
    {
      q: "What is the pass mark for the final assessment?",
      ...place(["60%", "30%", "90%", "There is no pass mark"], "60%", rnd),
    },
  ];

  return questions;
}
