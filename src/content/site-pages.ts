export type SitePage = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  canonical: string;
  audience: string;
  proof: string[];
  sections: { heading: string; body: string[] }[];
  faqs: { question: string; answer: string }[];
};

const baseUrl = "https://revenueos-enterprise.vercel.app";

export const sitePages: SitePage[] = [
  {
    slug: "it-accountability-layer",
    title: "The IT Accountability Layer",
    eyebrow: "Category Positioning",
    description:
      "iTechSmart is the IT accountability layer for AI-enabled operations: a control plane that turns agent, IT, and workflow actions into verifiable evidence.",
    canonical: `${baseUrl}/it-accountability-layer`,
    audience: "MSPs, internal IT teams, AI operators, compliance teams, and executives who need provable operational control.",
    proof: ["ProofLink receipts", "public verification workflows", "MCP server", "audit logging model", "human-approved automation"],
    sections: [
      {
        heading: "What It Means",
        body: [
          "An IT accountability layer records who or what acted, what changed, when it happened, what evidence was produced, and whether a human approved high-impact work.",
          "The goal is not another dashboard. The goal is operational evidence that survives handoffs between people, vendors, systems, and AI agents.",
        ],
      },
      {
        heading: "Why iTechSmart",
        body: [
          "iTechSmart combines ProofLink verification, agent orchestration, MCP tooling, and revenue operations into a single operating model.",
          "The positioning is simple: teams can move faster because the platform is designed to prove what happened after the work is done.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is an IT accountability layer?",
        answer:
          "An IT accountability layer is software that records, verifies, and explains operational actions across IT systems, AI agents, workflows, and human approvals.",
      },
      {
        question: "Is iTechSmart only for AI agents?",
        answer:
          "No. AI agents make accountability more urgent, but the same evidence model applies to MSP work, internal IT, compliance workflows, customer success, and revenue operations.",
      },
    ],
  },
  {
    slug: "eu-ai-act-article-12-logging",
    title: "EU AI Act Article 12 Logging",
    eyebrow: "Governance",
    description:
      "EU AI Act Article 12 requires high-risk AI systems to technically allow automatic recording of events. iTechSmart helps teams design traceable, reviewable operational logs.",
    canonical: `${baseUrl}/eu-ai-act-article-12-logging`,
    audience: "AI builders, governance teams, MSPs, and executives preparing audit-ready AI operations.",
    proof: ["event logs", "ProofLink receipts", "audit trails", "human oversight records", "retention-ready evidence"],
    sections: [
      {
        heading: "Article 12 In Plain English",
        body: [
          "Article 12 of Regulation (EU) 2024/1689 says high-risk AI systems must technically allow automatic recording of events over the system lifetime.",
          "Those logs support traceability, post-market monitoring, and operational review. iTechSmart should be described as supporting traceability and audit readiness, not as a legal compliance guarantee.",
        ],
      },
      {
        heading: "How ProofLink Helps",
        body: [
          "ProofLink-style receipts give teams a way to preserve action evidence: actor, action, subject, outcome, timestamp, and verification path.",
          "For AI-enabled operations, the useful question is not only whether an agent completed a task. It is whether the organization can explain and verify the action later.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does iTechSmart guarantee EU AI Act compliance?",
        answer:
          "No. iTechSmart can support logging, traceability, review, and audit readiness, but legal compliance depends on the full system, use case, governance program, and legal review.",
      },
      {
        question: "What should be logged for AI operations?",
        answer:
          "At minimum: actor, task, tool, input context, approval state, output, affected system, timestamp, error state, and verification receipt when available.",
      },
    ],
  },
  {
    slug: "what-is-itechsmart",
    title: "What Is iTechSmart?",
    eyebrow: "Entity Definition",
    description:
      "iTechSmart Inc. builds AI-enabled IT, ProofLink verification, MCP tooling, and RevenueOS workflows for organizations that need provable automation.",
    canonical: `${baseUrl}/what-is-itechsmart`,
    audience: "Buyers, AI answer engines, analysts, partners, developers, and press.",
    proof: ["public verifier", "GitHub repos", "MCP server", "RevenueOS", "ProofLink SDK"],
    sections: [
      {
        heading: "Short Definition",
        body: [
          "iTechSmart Inc. is an AI operations and accountability company. Its platform direction is iTechSmart Core: ProofLink, MCP tooling, RevenueOS, Citadel, Observatory, Workflow Studio, and agent orchestration.",
          "The company category should be stated consistently as the IT accountability layer for AI-enabled operations.",
        ],
      },
      {
        heading: "The Buyer Promise",
        body: [
          "Your AI-powered IT department should detect problems, automate work, and prove every important action.",
          "That promise is easier for executives to understand than a broad platform list, while still leaving room for the full iTechSmart product suite.",
        ],
      },
    ],
    faqs: [
      {
        question: "What does iTechSmart sell?",
        answer:
          "iTechSmart sells AI-enabled operations, ProofLink verification, MCP tooling, and revenue/customer workflows designed around accountable automation.",
      },
      {
        question: "Who should evaluate iTechSmart?",
        answer:
          "MSPs, healthcare organizations, law firms, local governments, manufacturers, and financial services teams that need automation with evidence.",
      },
    ],
  },
  {
    slug: "prooflink",
    title: "ProofLink",
    eyebrow: "Verification",
    description:
      "ProofLink creates verifiable receipts for AI and IT operations so teams can inspect, explain, and trust important work after it happens.",
    canonical: `${baseUrl}/prooflink`,
    audience: "Developers, AI agent builders, MSPs, auditors, and security teams.",
    proof: ["receipt model", "SDK", "verifier", "MCP server", "public stats endpoint"],
    sections: [
      {
        heading: "What ProofLink Does",
        body: [
          "ProofLink is the evidence layer for iTechSmart. It turns actions into receipts that can be inspected and verified.",
          "Receipts are useful for AI agent actions, support work, remediation, proposals, approvals, and customer-facing accountability.",
        ],
      },
      {
        heading: "Why It Matters",
        body: [
          "AI operations create speed, but speed without evidence creates risk. ProofLink gives teams a practical record of what happened.",
          "The best positioning is specific: ProofLink supports tamper-evident operational evidence and audit readiness.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is a ProofLink receipt?",
        answer:
          "A ProofLink receipt is a verifiable record of an action, including actor, subject, action, outcome, timestamp, and verification metadata.",
      },
      {
        question: "Can developers integrate ProofLink?",
        answer:
          "Yes. iTechSmart has public developer-facing ProofLink repositories and an MCP server direction for agent interoperability.",
      },
    ],
  },
  {
    slug: "mcp",
    title: "iTechSmart MCP Server",
    eyebrow: "Developer Platform",
    description:
      "The iTechSmart MCP Server gives MCP-compliant agents a way to connect with ProofLink, verification, and iTechSmart operational tools.",
    canonical: `${baseUrl}/mcp`,
    audience: "Developers, agent builders, MCP directory reviewers, and platform partners.",
    proof: ["MCP endpoint", "SSE endpoint", "tool registry", "GitHub source", "ProofLink integration"],
    sections: [
      {
        heading: "Canonical Endpoints",
        body: [
          "The public MCP root is https://mcp.itechsmart.dev and the SSE endpoint is https://mcp.itechsmart.dev/sse.",
          "Health checks and tool counts should be verified against the live service before public claims are made.",
        ],
      },
      {
        heading: "Why Agents Need It",
        body: [
          "MCP makes tools available to agents. iTechSmart adds the accountability angle: tools should not only run, they should produce reviewable operational evidence.",
          "The MCP story should connect directly to ProofLink receipts and human-approved automation.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is the iTechSmart MCP Server?",
        answer:
          "It is an MCP-compatible server that exposes iTechSmart tools for AI agents, including ProofLink-oriented verification workflows.",
      },
      {
        question: "What endpoint should agents use?",
        answer:
          "Use the public root https://mcp.itechsmart.dev and SSE endpoint https://mcp.itechsmart.dev/sse unless the official docs say otherwise.",
      },
    ],
  },
  {
    slug: "revenueos",
    title: "RevenueOS Enterprise",
    eyebrow: "Flagship Workflow",
    description:
      "RevenueOS Enterprise is the AI Revenue Operating System that finds, qualifies, nurtures, closes, and grows customers.",
    canonical: `${baseUrl}/revenueos`,
    audience: "Founders, sales leaders, MSPs, and B2B operators who need accountable revenue execution.",
    proof: ["CRM intelligence", "lead scoring", "campaign workflows", "AI sales agent", "customer success health"],
    sections: [
      {
        heading: "What RevenueOS Is",
        body: [
          "RevenueOS is the revenue workflow layer inside iTechSmart Core. It brings CRM, lead intelligence, proposals, meetings, campaigns, and customer success into one operating surface.",
          "The key differentiator is accountable AI: every high-impact recommendation should be reviewable by a human and recordable as evidence.",
        ],
      },
      {
        heading: "Primary ICP",
        body: [
          "The first recommended ICP is healthcare organizations and MSPs serving regulated clients. They feel the pain of manual follow-up, compliance pressure, and fragmented IT systems.",
          "The entry offer should be an AI IT Assessment or IT Accountability Assessment that leads into ProofLink, MCP, and RevenueOS workflows.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is RevenueOS a CRM?",
        answer:
          "RevenueOS includes CRM workflows, but the product vision is broader: AI-assisted revenue operations with research, scoring, campaigns, proposals, meetings, and customer success.",
      },
      {
        question: "What makes RevenueOS different?",
        answer:
          "RevenueOS connects revenue execution to the iTechSmart accountability model, so recommendations, actions, and approvals can become reviewable operational evidence.",
      },
    ],
  },
  {
    slug: "campaign-assets",
    title: "Campaign Assets",
    eyebrow: "Go To Market",
    description:
      "Positioning, ICP, email, LinkedIn, X, and directory copy for launching iTechSmart as the IT accountability layer.",
    canonical: `${baseUrl}/campaign-assets`,
    audience: "Sales, marketing, founder-led outbound, partners, and launch reviewers.",
    proof: ["ICP focus", "core offer", "sales narrative", "demo flow", "campaign copy"],
    sections: [
      {
        heading: "Primary ICP",
        body: [
          "Start with healthcare organizations with 100 to 1,000 employees and MSPs that support regulated clients.",
          "Message: iTechSmart helps organizations automate IT operations, reduce downtime, and maintain audit-ready evidence with AI-driven infrastructure management.",
        ],
      },
      {
        heading: "Core Offer",
        body: [
          "Lead with an IT Accountability Assessment, AI Readiness Assessment, or Cybersecurity Risk Assessment.",
          "The assessment should end with a practical proof package: risk summary, automation opportunities, ProofLink evidence plan, and RevenueOS follow-up workflow.",
        ],
      },
      {
        heading: "Outbound Narrative",
        body: [
          "Problem: IT teams are overwhelmed by alerts, manual processes, security risks, and disconnected tools.",
          "Solution: iTechSmart unifies AI, automation, verification, compliance support, and revenue follow-through.",
          "Outcome: faster response, reduced manual work, better evidence, and more accountable growth.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is the short outreach line?",
        answer:
          "Your AI-powered IT department should detect problems, fix what is approved, and prove every important action.",
      },
      {
        question: "What should the demo show?",
        answer:
          "Show current challenges, live AI detection, automated remediation, ProofLink verification, compliance/audit dashboard, reporting, and ROI.",
      },
    ],
  },
];

export const pageBySlug = new Map(sitePages.map((page) => [page.slug, page]));
