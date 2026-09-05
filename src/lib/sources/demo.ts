import type { RawOpportunity, SourceAdapter } from "./types";

// Demo Data Source: 30 realistic, fictional listings so the product is demonstrable without live feeds.
// Records are marked is_demo=1 in the database and can be purged once real sources are configured.

type Seed = [
  title: string,
  company: string,
  location: string,
  remote: "remote" | "hybrid" | "onsite",
  country: string,
  salary: string | null,
  skills: string[],
  nice: string[],
  minYears: number,
  seniority: string,
  type: string,
  daysAgo: number,
  description: string,
  visa?: boolean,
];

const COMPANIES: Record<string, { type: string; industry: string }> = {
  "Northwind Labs": { type: "product", industry: "AI Infrastructure" },
  "Kestrel AI": { type: "startup", industry: "Developer Tools" },
  "Lumen Analytics": { type: "product", industry: "Analytics SaaS" },
  "Orbital Health": { type: "product", industry: "Healthtech" },
  "Paperclip Finance": { type: "startup", industry: "Fintech" },
  "Vertex Commerce": { type: "product", industry: "E-commerce" },
  "Sable Systems": { type: "services", industry: "IT Services" },
  "Meridian Logistics": { type: "enterprise", industry: "Logistics" },
  "Bluefin Robotics": { type: "startup", industry: "Robotics" },
  "Halcyon Cloud": { type: "product", industry: "Cloud Infrastructure" },
};

const SEEDS: Seed[] = [
  ["Senior Python AI Engineer", "Northwind Labs", "Remote — India", "remote", "India", "₹25–35 LPA", ["Python", "LLM", "RAG", "Vector Databases", "FastAPI"], ["AWS", "Kubernetes"], 4, "senior", "full-time", 1,
    "Own the retrieval and generation layer of our AI platform used by enterprise customers. You'll design RAG pipelines, tune embedding strategies and ship production Python services with a small, senior team."],
  ["Machine Learning Engineer", "Kestrel AI", "Remote — Global", "remote", "Global", "$90k–130k", ["Python", "PyTorch", "LLM", "MLOps"], ["Rust"], 3, "mid", "full-time", 2,
    "Build the training and evaluation loop for our open-weight models. Expect to work across data pipelines, fine-tuning runs and inference optimisation in a fully remote team spanning four time zones."],
  ["AI Engineer (RAG Systems)", "Lumen Analytics", "Hyderabad", "hybrid", "India", "₹22–30 LPA", ["Python", "RAG", "Vector Databases", "LangChain", "PostgreSQL"], ["Azure"], 3, "mid", "full-time", 3,
    "Join the team building conversational analytics over customer data warehouses. You'll own retrieval quality, chunking strategies and evaluation harnesses. Hybrid: three days a week in our Hyderabad office."],
  ["Backend Engineer — Python", "Orbital Health", "Pune", "hybrid", "India", "₹18–26 LPA", ["Python", "Django", "PostgreSQL", "Redis"], ["AWS"], 3, "mid", "full-time", 1,
    "Build the APIs behind a patient-facing care platform used by hospitals across India. Strong focus on reliability, data privacy and clean service boundaries."],
  ["LLM Platform Engineer", "Halcyon Cloud", "Remote — Global", "remote", "Global", "$120k–160k", ["Python", "LLM", "Kubernetes", "AWS", "Go"], ["Rust"], 5, "senior", "full-time", 4,
    "Design the multi-tenant inference platform that serves our managed LLM offering. Deep infrastructure work: autoscaling GPU pools, request routing, observability and cost controls."],
  ["Data Scientist", "Paperclip Finance", "Mumbai", "onsite", "India", "₹15–22 LPA", ["Python", "SQL", "Pandas", "Scikit-learn"], ["Spark"], 2, "mid", "full-time", 5,
    "Build credit-risk and fraud models for a fast-growing lending product. You'll partner with product and risk teams and ship models to production with the platform team."],
  ["Staff AI Engineer", "Vertex Commerce", "Remote — India", "remote", "India", "₹45–60 LPA", ["Python", "LLM", "RAG", "Distributed Systems", "AWS"], ["Kubernetes"], 8, "lead", "full-time", 2,
    "Set technical direction for AI across search, recommendations and customer support. You'll lead architecture reviews, mentor senior engineers and stay hands-on in Python."],
  ["Python Developer", "Sable Systems", "Delhi NCR", "onsite", "India", "₹8–12 LPA", ["Python", "Flask", "MySQL"], [], 2, "junior", "full-time", 6,
    "Develop and maintain web applications for our enterprise clients. Work across multiple client projects with a delivery-focused team."],
  ["MLOps Engineer", "Northwind Labs", "Bengaluru", "hybrid", "India", "₹20–28 LPA", ["Python", "Kubernetes", "Docker", "MLflow", "AWS"], ["Terraform"], 3, "mid", "full-time", 7,
    "Own model deployment, monitoring and retraining infrastructure. You'll build the paved road our ML engineers use to ship models safely."],
  ["Frontend Engineer — React", "Lumen Analytics", "Hyderabad", "hybrid", "India", "₹14–20 LPA", ["React", "TypeScript", "CSS"], ["Next.js"], 3, "mid", "full-time", 3,
    "Build the dashboards and visual query builder our customers use daily. Strong attention to performance and accessibility expected."],
  ["Applied AI Engineer", "Kestrel AI", "Remote — India", "remote", "India", "₹24–32 LPA", ["Python", "LLM", "Prompt Engineering", "RAG", "FastAPI"], ["TypeScript"], 3, "mid", "full-time", 1,
    "Turn our models into products. You'll prototype quickly with customers, build evaluation sets, and harden the winners into production services."],
  ["Senior Backend Engineer (Go)", "Halcyon Cloud", "Berlin", "hybrid", "Germany", "€85k–105k", ["Go", "Kubernetes", "gRPC", "PostgreSQL"], ["Python"], 5, "senior", "full-time", 8,
    "Build the control plane for our managed Kubernetes product. Relocation and visa sponsorship available for the right candidate.", true],
  ["Machine Learning Engineer — Computer Vision", "Bluefin Robotics", "Singapore", "onsite", "Singapore", "S$90k–120k", ["Python", "PyTorch", "Computer Vision", "OpenCV", "C++"], ["ROS"], 3, "mid", "full-time", 4,
    "Train and deploy perception models on our warehouse robots. Work closely with hardware and controls engineers in our Singapore lab. Employment pass sponsorship provided.", true],
  ["AI Product Engineer", "Orbital Health", "Remote — India", "remote", "India", "₹20–30 LPA", ["Python", "LLM", "RAG", "React", "FastAPI"], ["Healthcare domain"], 3, "mid", "full-time", 2,
    "Full-stack role building clinician-facing AI assistants. You'll ship end to end: retrieval pipelines in Python, UI in React, and evals that keep clinicians safe."],
  ["Java Backend Developer", "Meridian Logistics", "Chennai", "onsite", "India", "₹12–18 LPA", ["Java", "Spring Boot", "Kafka"], [], 3, "mid", "full-time", 9,
    "Maintain and extend the order-tracking services powering our freight network. High-throughput event processing on Kafka."],
  ["Senior Data Engineer", "Vertex Commerce", "Bengaluru", "hybrid", "India", "₹28–38 LPA", ["Python", "Spark", "Airflow", "SQL", "AWS"], ["dbt"], 5, "senior", "full-time", 5,
    "Own the lakehouse feeding our recommendation and analytics teams. Design pipelines that process billions of events daily."],
  ["NLP Engineer", "Lumen Analytics", "Remote — India", "remote", "India", "₹20–28 LPA", ["Python", "NLP", "Transformers", "spaCy", "LLM"], ["Vector Databases"], 3, "mid", "full-time", 6,
    "Build entity extraction, classification and summarisation features over messy enterprise text. You'll evaluate when a fine-tuned small model beats an LLM call, and ship both."],
  ["Founding AI Engineer", "Paperclip Finance", "Mumbai", "hybrid", "India", "₹30–45 LPA", ["Python", "LLM", "RAG", "PostgreSQL", "AWS"], ["Fintech"], 4, "senior", "full-time", 1,
    "First AI hire. You'll build the document-understanding and underwriting assistant from scratch, with meaningful equity and direct access to founders."],
  ["DevOps Engineer", "Sable Systems", "Noida", "onsite", "India", "₹10–15 LPA", ["Linux", "AWS", "Docker", "Jenkins"], ["Kubernetes"], 3, "mid", "full-time", 10,
    "Manage CI/CD pipelines and cloud infrastructure for multiple client engagements."],
  ["Python Engineer — Data Platform", "Meridian Logistics", "Remote — India", "remote", "India", "₹16–22 LPA", ["Python", "SQL", "Airflow", "PostgreSQL"], ["Spark"], 3, "mid", "full-time", 3,
    "Build the ingestion and reporting pipelines behind our shipment analytics. Remote-first team within India."],
  ["Research Engineer — LLM Training", "Kestrel AI", "Remote — Global", "remote", "Global", "$140k–190k", ["Python", "PyTorch", "LLM", "CUDA", "Distributed Systems"], ["JAX"], 5, "senior", "full-time", 2,
    "Push pretraining efficiency on multi-node GPU clusters. You'll write custom kernels, debug distributed training and publish what you learn."],
  ["Engineering Manager — AI Platform", "Northwind Labs", "Bengaluru", "hybrid", "India", "₹55–75 LPA", ["Python", "LLM", "People Management", "System Design"], ["AWS"], 8, "manager", "full-time", 7,
    "Lead a team of eight engineers building our AI platform. You'll own hiring, roadmap and delivery while staying technical enough to review designs."],
  ["Junior Python Developer", "Orbital Health", "Pune", "onsite", "India", "₹6–9 LPA", ["Python", "Django", "SQL"], [], 0, "junior", "full-time", 4,
    "Entry-level role on our care platform team. Strong fundamentals matter more than years of experience."],
  ["Product Manager — AI", "Vertex Commerce", "Bengaluru", "hybrid", "India", "₹30–40 LPA", ["Product Management", "AI", "Analytics"], ["SQL"], 5, "senior", "full-time", 8,
    "Own the roadmap for AI-powered search and discovery. Partner with engineering and data science to ship features that move conversion."],
  ["Senior AI Engineer", "Halcyon Cloud", "Remote — Global", "remote", "Global", "$130k–170k", ["Python", "LLM", "RAG", "Vector Databases", "AWS", "Kubernetes"], ["Go"], 5, "senior", "full-time", 1,
    "Build retrieval-augmented features into our developer platform: semantic search over docs, incident summarisation and an AI assistant for our CLI. Visa sponsorship available for relocation to the EU.", true],
  ["AI Solutions Engineer", "Sable Systems", "Remote — India", "remote", "India", "₹14–20 LPA", ["Python", "LLM", "Client Communication", "REST APIs"], ["RAG"], 3, "mid", "full-time", 5,
    "Customer-facing engineering role implementing LLM solutions for enterprise clients. Mix of scoping, prototyping and delivery."],
  ["Machine Learning Engineer — Recommendations", "Vertex Commerce", "Remote — India", "remote", "India", "₹26–36 LPA", ["Python", "PyTorch", "Recommender Systems", "Spark", "AWS"], ["Vector Databases"], 4, "senior", "full-time", 2,
    "Improve the ranking models behind our home feed and product recommendations. Own experiments from offline evaluation through online A/B tests."],
  ["Contract Python Developer (6 months)", "Meridian Logistics", "Remote — India", "remote", "India", "₹1.5–2L/month", ["Python", "FastAPI", "PostgreSQL"], [], 3, "mid", "contract", 3,
    "Six-month contract to build internal tooling for our operations team. Possible extension based on performance."],
  ["AI Engineering Intern", "Bluefin Robotics", "Singapore", "onsite", "Singapore", "S$1500/month", ["Python", "PyTorch"], [], 0, "intern", "internship", 6,
    "Six-month internship supporting our perception team with data labelling tooling and model evaluation."],
  ["Backend Engineer — AI Infrastructure", "Kestrel AI", "Remote — India", "remote", "India", "₹28–40 LPA", ["Python", "Go", "Kubernetes", "AWS", "PostgreSQL"], ["LLM"], 4, "senior", "full-time", 1,
    "Build the serving and orchestration layer for our model APIs. High-scale systems work with a Python-first team that isn't afraid of Go where it matters."],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

function toRaw(s: Seed, sourceName = "Demo Source", host = "demo.opportunityhunter.app"): RawOpportunity {
  const [title, company, location, remote, country, salary, skills, nice, min_years, seniority, type, days, description, visa] = s;
  const url = `https://${host}/jobs/${slug(company)}/${slug(title)}`;
  return {
    source_name: sourceName,
    source_url: url,
    title,
    company,
    location,
    salary,
    description,
    posted_date: daysAgo(days),
    application_url: `${url}/apply`,
    employment_type: type,
    skills,
    nice_to_have: nice,
    min_years,
    seniority,
    remote_type: remote,
    country,
    company_type: COMPANIES[company].type,
    industry: COMPANIES[company].industry,
    visa_sponsorship: visa ?? false,
  };
}

export const demoSource: SourceAdapter = {
  name: "Demo Source",
  category: "job",
  configured: true,
  async fetch() {
    const records = SEEDS.map((s) => toRaw(s));
    // A second listing of the first job via an "aggregator" with a different URL and tracking params;
    // deduplicateOpportunities() must collapse it into the original.
    const dup = toRaw(SEEDS[0], "Demo Aggregator", "jobs.demo-aggregator.example");
    dup.source_url += "?utm_source=aggregator&ref=123";
    dup.title = "Senior Python AI Engineer (Remote)";
    return [...records, dup];
  },
};
