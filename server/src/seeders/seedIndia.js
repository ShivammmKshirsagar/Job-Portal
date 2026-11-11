import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Company from '../models/Company.js';
import Job from '../models/Job.js';
import Taxonomy from '../models/Taxonomy.js';
import { connectDB, closeDB } from '../config/db.js';
import { ensureSampleResumesExist } from './seed.js';

// Ensure server/.env is loaded if available
const serverEnvPath = path.resolve(import.meta.dirname, '../../.env');
if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else {
  dotenv.config();
}

/**
 * Idempotent, Non-Destructive Seeder for CareerConnect India Localisation.
 *
 * CRITICAL SAFETY RULES:
 * 1. Safe execution: Never drops the database.
 * 2. Never deletes existing users or candidate accounts.
 * 3. Uses upsert (find and create/update) for companies and jobs.
 * 4. Preserves existing accounts while ensuring demo employers exist.
 * 5. Can be executed multiple times without duplicating data.
 */

// Demonstration Employers (Assigned to respective companies)
const demoEmployers = [
  {
    name: 'Priya Sharma',
    email: 'recruiter.aarohan@careerconnect.in',
    password: 'EmployerPassword123!',
    role: 'employer',
    title: 'Head of Talent Acquisition',
    location: 'Bengaluru, Karnataka',
    companyName: 'Aarohan Technologies',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Rohan Mehra',
    email: 'recruiter.finedge@careerconnect.in',
    password: 'EmployerPassword123!',
    role: 'employer',
    title: 'Senior Engineering Recruitment Manager',
    location: 'Mumbai, Maharashtra',
    companyName: 'FinEdge Systems',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Ananya Iyer',
    email: 'recruiter.bluepeak@careerconnect.in',
    password: 'EmployerPassword123!',
    role: 'employer',
    title: 'People Operations Lead',
    location: 'Hyderabad, Telangana',
    companyName: 'BluePeak Analytics',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Vikram Joshi',
    email: 'recruiter.pixelforge@careerconnect.in',
    password: 'EmployerPassword123!',
    role: 'employer',
    title: 'Design Director & Co-Founder',
    location: 'Pune, Maharashtra',
    companyName: 'PixelForge Labs',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Kavita Nair',
    email: 'recruiter.nexora@careerconnect.in',
    password: 'EmployerPassword123!',
    role: 'employer',
    title: 'Technical Staffing Partner',
    location: 'Gurugram, Haryana',
    companyName: 'Nexora Digital',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Arjun Verma',
    email: 'recruiter.cloudbridge@careerconnect.in',
    password: 'EmployerPassword123!',
    role: 'employer',
    title: 'Cloud Practice Hiring Lead',
    location: 'Noida, Uttar Pradesh',
    companyName: 'CloudBridge Solutions',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  },
];

// Fictional Indian Companies
const indianCompaniesData = [
  {
    name: 'Aarohan Technologies',
    logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
    description: 'Aarohan Technologies engineers high-performance enterprise SaaS platforms, AI-driven automation workflows, and cloud-native ERP solutions powering modern Indian and global corporations.',
    culture: 'Engineering craftsmanship, high ownership, customer obsession, and transparent cross-functional collaboration.',
    website: 'https://aarohan-tech.example.in',
    location: 'Bengaluru, Karnataka',
    industry: 'Enterprise Software',
    size: '500-1000 Employees',
    foundedYear: 2017,
    stage: 'Series B',
  },
  {
    name: 'Nexora Digital',
    logoUrl: 'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=128&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&auto=format&fit=crop&q=80',
    description: 'Nexora Digital is a premier digital engineering studio architecting resilient consumer web experiences, high-throughput mobile apps, and scalable design systems.',
    culture: 'Design-led engineering, rapid prototyping, agile delivery, and psychological safety.',
    website: 'https://nexoradigital.example.in',
    location: 'Gurugram, Haryana',
    industry: 'Design & Marketing',
    size: '100-250 Employees',
    foundedYear: 2019,
    stage: 'Growth',
  },
  {
    name: 'BluePeak Analytics',
    logoUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=128&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&auto=format&fit=crop&q=80',
    description: 'BluePeak Analytics empowers decision-makers with streaming data pipelines, predictive machine learning models, and real-time operational telemetry at enterprise scale.',
    culture: 'Scientific rigor, data-informed strategy, continuous learning, and outcome-oriented delivery.',
    website: 'https://bluepeakanalytics.example.in',
    location: 'Hyderabad, Telangana',
    industry: 'FinTech',
    size: '250-500 Employees',
    foundedYear: 2018,
    stage: 'Series A',
  },
  {
    name: 'PixelForge Labs',
    logoUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=128&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&auto=format&fit=crop&q=80',
    description: 'PixelForge Labs creates immersive digital tools, intuitive consumer applications, and interactive user interfaces loved by millions of digital creators.',
    culture: 'Creative autonomy, user empathy, rapid experimentation, and asynchronous remote teamwork.',
    website: 'https://pixelforgelabs.example.in',
    location: 'Pune, Maharashtra',
    industry: 'Consumer Tech',
    size: '50-150 Employees',
    foundedYear: 2020,
    stage: 'Growth',
  },
  {
    name: 'FinEdge Systems',
    logoUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=128&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1200&auto=format&fit=crop&q=80',
    description: 'FinEdge Systems develops ultra-secure UPI payment gateways, algorithmic risk models, and core banking middleware processing over 10 million daily financial transactions.',
    culture: 'Zero-tolerance for downtime, rigorous security compliance, mentorship, and high-performance engineering.',
    website: 'https://finedgesystems.example.in',
    location: 'Mumbai, Maharashtra',
    industry: 'FinTech',
    size: '1000-5000 Employees',
    foundedYear: 2015,
    stage: 'Public',
  },
  {
    name: 'CloudBridge Solutions',
    logoUrl: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=128&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80',
    description: 'CloudBridge Solutions delivers end-to-end cloud migration, automated Kubernetes orchestration, DevSecOps pipelines, and multi-region infrastructure reliability.',
    culture: 'Infrastructure as code, automation by default, continuous resilience testing, and collaborative problem solving.',
    website: 'https://cloudbridgesolutions.example.in',
    location: 'Noida, Uttar Pradesh',
    industry: 'Cloud Infrastructure',
    size: '500-1000 Employees',
    foundedYear: 2016,
    stage: 'Growth',
  },
];

// 18 Diverse Indian Job Listings
const indianJobsData = [
  // 1. React Developer
  {
    title: 'Senior React Developer',
    companyName: 'Aarohan Technologies',
    category: 'Development',
    jobType: 'Full-Time',
    experienceLevel: 'Senior Level',
    workplaceType: 'Hybrid',
    location: 'Bengaluru, Karnataka (Hybrid)',
    salaryMin: 1800000,
    salaryMax: 2800000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: true,
    skillsRequired: ['React', 'TypeScript', 'Next.js', 'Redux Toolkit', 'Tailwind CSS'],
    description: 'Join Aarohan Technologies to lead frontend engineering for our flagship enterprise cloud platform. You will design component architectures, drive core web vitals performance, and collaborate with product design to ship responsive interfaces used across India and global markets.',
    responsibilities: [
      'Architect and build high-performance React 19 single-page applications with clean TypeScript patterns.',
      'Establish robust frontend testing strategies using Vitest, React Testing Library, and Cypress.',
      'Contribute to our unified design system with accessibility (a11y) and modular components.',
      'Mentor junior engineers and conduct rigorous code reviews.',
    ],
    requirements: [
      '5+ years of hands-on experience building complex web applications with modern React.',
      'Deep proficiency in TypeScript, state management, and modern bundling tooling (Vite).',
      'Solid grasp of browser performance optimization, network latency, and responsive UI.',
      'Strong communication and ability to work in an agile, cross-functional team.',
    ],
  },

  // 2. Full Stack Developer (MERN)
  {
    title: 'Full Stack Developer (MERN)',
    companyName: 'Aarohan Technologies',
    category: 'Development',
    jobType: 'Full-Time',
    experienceLevel: 'Mid Level',
    workplaceType: 'On-site',
    location: 'Bengaluru, Karnataka',
    salaryMin: 1000000,
    salaryMax: 1600000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: true,
    skillsRequired: ['React', 'Node.js', 'Express', 'MongoDB', 'REST APIs', 'Git'],
    description: 'We are seeking an energetic Full Stack Developer to build feature slices from MongoDB schemas up to polished React client interfaces. You will take ownership of end-to-end user workflows in our internal SaaS modules.',
    responsibilities: [
      'Build scalable backend REST endpoints using Node.js, Express, and Mongoose.',
      'Implement intuitive client-side views with React and Tailwind CSS.',
      'Write comprehensive unit and integration tests for API endpoints.',
      'Participate in sprint planning and daily standups.',
    ],
    requirements: [
      '2–4 years of full-stack JavaScript / TypeScript production experience.',
      'Solid knowledge of MongoDB indexing, schema design, and query optimization.',
      'Familiarity with JWT authentication, role-based access control, and API security.',
    ],
  },

  // 3. Node.js Backend Developer
  {
    title: 'Node.js Backend Developer',
    companyName: 'FinEdge Systems',
    category: 'Development',
    jobType: 'Full-Time',
    experienceLevel: 'Senior Level',
    workplaceType: 'Hybrid',
    location: 'Mumbai, Maharashtra (Hybrid)',
    salaryMin: 2000000,
    salaryMax: 3200000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: true,
    skillsRequired: ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'Kafka', 'Microservices'],
    description: 'FinEdge Systems is looking for a Senior Node.js Backend Engineer to scale our mission-critical transaction routing engines. You will build high-concurrency payment APIs and event-driven microservices.',
    responsibilities: [
      'Design fault-tolerant backend services handling thousands of transactions per second.',
      'Implement distributed caching strategies with Redis and message streaming with Kafka.',
      'Enforce zero-trust security, encryption-at-rest, and OWASP best practices.',
      'Conduct performance profiling and bottleneck elimination in asynchronous Node.js runtimes.',
    ],
    requirements: [
      '5+ years of backend development experience with high-load Node.js microservices.',
      'Proficiency in asynchronous design patterns, event loops, and database connection pooling.',
      'Experience in fintech, payment gateways, or distributed transaction systems is a major plus.',
    ],
  },

  // 4. Java Developer
  {
    title: 'Java Enterprise Developer',
    companyName: 'FinEdge Systems',
    category: 'Development',
    jobType: 'Full-Time',
    experienceLevel: 'Mid Level',
    workplaceType: 'On-site',
    location: 'Mumbai, Maharashtra',
    salaryMin: 1200000,
    salaryMax: 1800000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: false,
    skillsRequired: ['Java 17', 'Spring Boot', 'Hibernate', 'MySQL', 'Docker', 'REST APIs'],
    description: 'Join our core banking integration team building robust, ACID-compliant Spring Boot microservices. You will interface directly with partner banks and clearing house protocols across India.',
    responsibilities: [
      'Develop secure, maintainable RESTful services using Spring Boot and Spring Security.',
      'Design relational schemas, JPA mappings, and complex SQL stored procedures.',
      'Collaborate with QA to build automated integration test suites.',
    ],
    requirements: [
      '3+ years of professional backend development with Java and Spring Boot ecosystem.',
      'Deep understanding of OOP design patterns, transaction management, and multithreading.',
    ],
  },

  // 5. Python Developer
  {
    title: 'Python Backend Developer',
    companyName: 'BluePeak Analytics',
    category: 'Development',
    jobType: 'Full-Time',
    experienceLevel: 'Mid Level',
    workplaceType: 'Hybrid',
    location: 'Hyderabad, Telangana (Hybrid)',
    salaryMin: 1100000,
    salaryMax: 1700000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: false,
    skillsRequired: ['Python', 'FastAPI', 'Django', 'PostgreSQL', 'Celery', 'Redis'],
    description: 'BluePeak Analytics is hiring a Python Developer to build rapid REST and GraphQL endpoints feeding our business intelligence dashboard. You will bridge analytical pipelines and web consumers.',
    responsibilities: [
      'Build asynchronous API endpoints using FastAPI and asyncpg.',
      'Manage background task queues with Celery and Redis for asynchronous report generation.',
      'Optimize complex aggregation queries over multi-million row datasets.',
    ],
    requirements: [
      '3+ years of production experience in Python backend development (FastAPI or Django).',
      'Solid foundation in relational database design, query optimization, and REST API design.',
    ],
  },

  // 6. Data Analyst
  {
    title: 'Data Analyst',
    companyName: 'BluePeak Analytics',
    category: 'Data',
    jobType: 'Full-Time',
    experienceLevel: 'Entry Level',
    workplaceType: 'On-site',
    location: 'Hyderabad, Telangana',
    salaryMin: 500000,
    salaryMax: 800000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: false,
    skillsRequired: ['SQL', 'Power BI', 'Python', 'Tableau', 'Excel', 'Data Modeling'],
    description: 'We are seeking a detail-oriented Data Analyst to turn raw business metrics into actionable visual dashboards. You will work directly with product managers and business stakeholders.',
    responsibilities: [
      'Author complex SQL queries to extract, transform, and clean transactional data.',
      'Build interactive dashboards in Power BI and Tableau for executive decision-makers.',
      'Perform exploratory cohort and retention analysis to uncover operational insights.',
    ],
    requirements: [
      'B.Tech / B.Sc in Computer Science, Statistics, Mathematics or related field.',
      'Strong expertise in SQL (joins, window functions, CTEs) and data visualization.',
      'Working knowledge of Python (pandas, matplotlib) is preferred.',
    ],
  },

  // 7. Data Scientist
  {
    title: 'Senior Data Scientist',
    companyName: 'BluePeak Analytics',
    category: 'Data',
    jobType: 'Full-Time',
    experienceLevel: 'Senior Level',
    workplaceType: 'Remote',
    location: 'Remote — India',
    salaryMin: 2200000,
    salaryMax: 3500000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: true,
    skillsRequired: ['Python', 'PyTorch', 'Scikit-learn', 'Statistics', 'NLP', 'MLOps'],
    description: 'Lead predictive modeling initiatives at BluePeak Analytics. You will conceptualize and train production-grade statistical models, NLP extractors, and recommendation engines deployed at scale.',
    responsibilities: [
      'Formulate business problems into machine learning hypotheses and evaluation frameworks.',
      'Build, validate, and tune supervised and unsupervised ML models using Python.',
      'Collaborate with MLOps engineers to containerize and deploy models with continuous monitoring.',
    ],
    requirements: [
      '5+ years of applied machine learning experience in production environments.',
      'Strong theoretical foundation in probability, statistics, and linear algebra.',
      'Experience with transformer models (HuggingFace) and vector embeddings is a strong advantage.',
    ],
  },

  // 8. Machine Learning Engineer
  {
    title: 'Machine Learning Engineer',
    companyName: 'BluePeak Analytics',
    category: 'Data',
    jobType: 'Full-Time',
    experienceLevel: 'Mid Level',
    workplaceType: 'Hybrid',
    location: 'Bengaluru, Karnataka (Hybrid)',
    salaryMin: 1500000,
    salaryMax: 2400000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: true,
    skillsRequired: ['Python', 'TensorFlow', 'MLflow', 'Docker', 'Kubernetes', 'FastAPI'],
    description: 'Bridge data science prototypes and production scale. As an ML Engineer, you will build automated training pipelines, model registries, and low-latency inference services.',
    responsibilities: [
      'Package and deploy ML models as low-latency microservices using FastAPI and Docker.',
      'Build reproducible feature stores and automated CI/CD pipelines for model retraining.',
      'Monitor model drift, latency SLAs, and resource utilization across GPU clusters.',
    ],
    requirements: [
      '3+ years of experience engineering production ML infrastructure and pipelines.',
      'Familiarity with Kubernetes, MLflow, Triton Inference Server, or Kubeflow.',
    ],
  },

  // 9. DevOps Engineer
  {
    title: 'DevOps & Cloud Engineer',
    companyName: 'CloudBridge Solutions',
    category: 'DevOps & Infrastructure',
    jobType: 'Full-Time',
    experienceLevel: 'Senior Level',
    workplaceType: 'Hybrid',
    location: 'Noida, Uttar Pradesh (Hybrid)',
    salaryMin: 1600000,
    salaryMax: 2600000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: false,
    skillsRequired: ['AWS', 'Kubernetes', 'Terraform', 'Docker', 'CI/CD', 'Linux'],
    description: 'CloudBridge Solutions is seeking an experienced DevOps Engineer to design multi-tenant Kubernetes clusters and automate deployment pipelines for high-availability enterprise services.',
    responsibilities: [
      'Manage Infrastructure as Code across AWS using Terraform and Ansible.',
      'Maintain production EKS clusters, helm charts, ingress controllers, and service meshes.',
      'Build hardened GitHub Actions and GitLab CI/CD pipelines with automated security scans.',
      'Implement centralized observability with Prometheus, Grafana, and ELK stack.',
    ],
    requirements: [
      '4+ years of hands-on DevOps / SRE experience in cloud-native production environments.',
      'Certified Kubernetes Administrator (CKA) or AWS Solutions Architect certification is a plus.',
    ],
  },

  // 10. Cloud Solutions Architect
  {
    title: 'Cloud Solutions Architect',
    companyName: 'CloudBridge Solutions',
    category: 'DevOps & Infrastructure',
    jobType: 'Full-Time',
    experienceLevel: 'Lead / Executive',
    workplaceType: 'On-site',
    location: 'Gurugram, Haryana',
    salaryMin: 3000000,
    salaryMax: 4500000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: true,
    skillsRequired: ['AWS', 'Azure', 'System Design', 'Terraform', 'Microservices', 'Security Governance'],
    description: 'Provide architectural leadership for large-scale enterprise cloud transformations. You will design disaster-recovery strategies, cost-optimized compute footprints, and zero-trust cloud boundaries.',
    responsibilities: [
      'Architect resilient, multi-region cloud infrastructures for tier-1 enterprise clients.',
      'Evaluate architectural tradeoffs between latency, throughput, compliance, and cost.',
      'Advise C-level client executives on cloud migration roadmaps and governance standards.',
    ],
    requirements: [
      '8+ years designing complex distributed systems with deep AWS or Azure mastery.',
      'Proven track record architecting mission-critical platforms with 99.99% uptime SLAs.',
    ],
  },

  // 11. UI/UX Designer
  {
    title: 'UI/UX Product Designer',
    companyName: 'PixelForge Labs',
    category: 'Design',
    jobType: 'Full-Time',
    experienceLevel: 'Mid Level',
    workplaceType: 'Hybrid',
    location: 'Pune, Maharashtra (Hybrid)',
    salaryMin: 850000,
    salaryMax: 1400000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: true,
    skillsRequired: ['Figma', 'UI/UX Design', 'Design Systems', 'User Research', 'Prototyping'],
    description: 'PixelForge Labs is looking for a creative UI/UX Product Designer to craft intuitive, delightful web and mobile interfaces. You will translate complex workflows into simple, elegant digital interactions.',
    responsibilities: [
      'Design responsive layouts, wireframes, user journeys, and micro-interactions in Figma.',
      'Maintain and extend our unified design token library and shared component patterns.',
      'Conduct usability tests and iterate designs based on quantitative and qualitative feedback.',
    ],
    requirements: [
      '3+ years of experience designing modern digital SaaS or consumer web applications.',
      'Strong portfolio demonstrating high aesthetic craft, typography, and human-centered design.',
    ],
  },

  // 12. Senior UX Researcher
  {
    title: 'Senior UX Researcher',
    companyName: 'PixelForge Labs',
    category: 'Design',
    jobType: 'Full-Time',
    experienceLevel: 'Senior Level',
    workplaceType: 'Remote',
    location: 'Remote — India',
    salaryMin: 1400000,
    salaryMax: 2200000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: false,
    skillsRequired: ['Qualitative Research', 'Usability Testing', 'Information Architecture', 'Figma', 'Survey Design'],
    description: 'Lead user research initiatives to uncover deep behavioural patterns of our users across pan-Indian demographics. You will guide product roadmaps with empirical user insights.',
    responsibilities: [
      'Plan and execute qualitative interviews, usability testing, and card sorting studies.',
      'Distill complex research data into compelling user personas, journey maps, and executive briefs.',
    ],
    requirements: [
      '5+ years of user research experience with consumer or enterprise digital products.',
      'Demonstrated expertise in qualitative and quantitative research methodologies.',
    ],
  },

  // 13. Cybersecurity Analyst
  {
    title: 'Cybersecurity Analyst',
    companyName: 'FinEdge Systems',
    category: 'Development',
    jobType: 'Full-Time',
    experienceLevel: 'Mid Level',
    workplaceType: 'On-site',
    location: 'Mumbai, Maharashtra',
    salaryMin: 1200000,
    salaryMax: 1900000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: false,
    skillsRequired: ['Network Security', 'SIEM', 'Threat Modeling', 'OWASP', 'Vulnerability Assessment', 'ISO 27001'],
    description: 'Protect vital financial infrastructure against sophisticated threats. You will monitor security event streams, coordinate vulnerability assessments, and ensure compliance with RBI cybersecurity directives.',
    responsibilities: [
      'Monitor and triage security telemetry from SIEM, EDR, and cloud audit logs.',
      'Conduct regular static and dynamic vulnerability scans across APIs and web endpoints.',
      'Lead incident response drills and collaborate with engineering on rapid patch deployments.',
    ],
    requirements: [
      '3+ years in security operations (SOC), penetration testing, or defensive security.',
      'Certifications such as CEH, CompTIA Security+, or CISSP associate are valued.',
    ],
  },

  // 14. QA Automation Engineer
  {
    title: 'QA Automation Engineer',
    companyName: 'Nexora Digital',
    category: 'Development',
    jobType: 'Full-Time',
    experienceLevel: 'Mid Level',
    workplaceType: 'Hybrid',
    location: 'Gurugram, Haryana (Hybrid)',
    salaryMin: 750000,
    salaryMax: 1250000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: false,
    skillsRequired: ['Cypress', 'Playwright', 'Selenium', 'JavaScript', 'Postman', 'CI/CD'],
    description: 'Nexora Digital is looking for an enthusiastic QA Automation Engineer to ensure our client applications ship bug-free. You will write robust end-to-end tests for modern web and mobile apps.',
    responsibilities: [
      'Develop automated regression and integration test suites using Cypress and Playwright.',
      'Build API contract verification tests using Postman, Newman, and Jest.',
      'Integrate test execution into CI/CD pipelines for automated branch validation.',
    ],
    requirements: [
      '3+ years in automated software testing for web applications.',
      'Proficiency in JavaScript / TypeScript and modern browser automation tools.',
    ],
  },

  // 15. Product Manager
  {
    title: 'Technical Product Manager',
    companyName: 'Nexora Digital',
    category: 'Management',
    jobType: 'Full-Time',
    experienceLevel: 'Senior Level',
    workplaceType: 'Hybrid',
    location: 'Delhi NCR (Hybrid)',
    salaryMin: 2200000,
    salaryMax: 3400000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: true,
    skillsRequired: ['Product Strategy', 'Agile / Scrum', 'Data Analytics', 'Jira', 'Technical Writing', 'PRDs'],
    description: 'Lead product definition and execution for high-impact enterprise digital platforms. You will partner with engineering leads, corporate stakeholders, and UX designers to ship transformative products.',
    responsibilities: [
      'Own product vision, roadmap prioritization, and sprint backlog management.',
      'Author crisp Product Requirement Documents (PRDs) and user stories with measurable acceptance criteria.',
      'Track north star engagement metrics and run data-driven product experiments.',
    ],
    requirements: [
      '5+ years in product management with a track record of launching successful software products.',
      'Strong technical grounding capable of discussing API contracts and architectural tradeoffs.',
    ],
  },

  // 16. Frontend Engineering Intern
  {
    title: 'Frontend Engineering Intern',
    companyName: 'PixelForge Labs',
    category: 'Development',
    jobType: 'Internship',
    experienceLevel: 'Entry Level',
    workplaceType: 'Hybrid',
    location: 'Pune, Maharashtra (Hybrid)',
    salaryMin: 300000,
    salaryMax: 480000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: false,
    skillsRequired: ['JavaScript', 'React', 'HTML5', 'CSS3', 'Git', 'Tailwind CSS'],
    description: 'Exciting 6-month internship opportunity for recent graduates and final-year students passionate about frontend engineering. You will learn modern React patterns under seasoned mentorship.',
    responsibilities: [
      'Assist in implementing reusable UI components and responsive layouts.',
      'Fix UI bugs, improve accessibility compliance, and write component unit tests.',
      'Learn modern production tooling: Vite, TypeScript, Git, and automated deployments.',
    ],
    requirements: [
      'Strong foundation in core JavaScript (ES6+), HTML, and CSS fundamentals.',
      'Hands-on personal or academic project experience with React.',
      'Eager to learn and accept constructive code review feedback.',
    ],
  },

  // 17. Junior Data Scientist
  {
    title: 'Junior Data Scientist',
    companyName: 'BluePeak Analytics',
    category: 'Data',
    jobType: 'Full-Time',
    experienceLevel: 'Entry Level',
    workplaceType: 'On-site',
    location: 'Ahmedabad, Gujarat',
    salaryMin: 600000,
    salaryMax: 900000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: false,
    skillsRequired: ['Python', 'Pandas', 'NumPy', 'Scikit-learn', 'SQL', 'Data Wrangling'],
    description: 'Start your data science journey at BluePeak Analytics. You will work on real-world industrial telemetry data, data cleansing, feature engineering, and exploratory modeling.',
    responsibilities: [
      'Cleanse and preprocess heterogeneous datasets across relational and document stores.',
      'Build benchmark regression and classification models using scikit-learn.',
      'Document model findings and generate analytical summary decks for project leads.',
    ],
    requirements: [
      'Degree in Computer Science, Data Science, Mathematics, or engineering discipline.',
      'Hands-on proficiency in Python, Pandas, and SQL.',
    ],
  },

  // 18. Mobile App Developer (Flutter / React Native)
  {
    title: 'Mobile App Developer (Flutter / React Native)',
    companyName: 'Nexora Digital',
    category: 'Development',
    jobType: 'Full-Time',
    experienceLevel: 'Mid Level',
    workplaceType: 'Hybrid',
    location: 'Chennai, Tamil Nadu (Hybrid)',
    salaryMin: 900000,
    salaryMax: 1500000,
    salaryCurrency: 'INR',
    salaryPeriod: 'yearly',
    featured: false,
    skillsRequired: ['React Native', 'Flutter', 'Dart', 'TypeScript', 'Mobile UI', 'REST APIs'],
    description: 'Develop slick, cross-platform Android and iOS applications with smooth 60fps animations and offline sync capabilities for retail and logistics clients.',
    responsibilities: [
      'Build fluid cross-platform mobile apps using React Native or Flutter.',
      'Integrate device native capabilities (camera, push notifications, offline SQLite caching).',
      'Optimize bundle size, launch speed, and memory consumption across diverse Android devices.',
    ],
    requirements: [
      '2–4 years of experience building and releasing mobile applications to Google Play or Apple App Store.',
      'Strong grasp of state management, responsive UI layouts, and asynchronous networking.',
    ],
  },
];

/**
 * Executes the safe, idempotent India seeding routine.
 *
 * @param {object} options
 * @param {boolean} [options.isDryRun=false] - When true, computes actions without modifying database.
 * @returns {Promise<object>} Summary of operations.
 */
export const seedIndiaDatabase = async ({ isDryRun = false } = {}) => {
  const summary = {
    targetDatabase: mongoose.connection.name || 'unknown',
    isDryRun,
    employers: { processed: 0, created: 0, existing: 0 },
    companies: { processed: 0, created: 0, updated: 0 },
    jobs: { processed: 0, created: 0, updated: 0 },
    candidatesUntouched: 0,
    sampleResumesChecked: true,
  };

  try {
    ensureSampleResumesExist();

    // 1. Check existing candidates count for safety verification
    const existingCandidatesCount = await User.countDocuments({ role: 'candidate' });
    summary.candidatesUntouched = existingCandidatesCount;
    console.log(`[Seed:India] Pre-check: ${existingCandidatesCount} registered candidate accounts found. All will be preserved.`);

    if (isDryRun) {
      console.log('[Seed:India] Running in DRY-RUN mode. No database mutations will be applied.');
      summary.companies.processed = indianCompaniesData.length;
      summary.jobs.processed = indianJobsData.length;
      summary.employers.processed = demoEmployers.length;
      return summary;
    }

    // 2. Safe upsert of demo employers (preserves existing credentials)
    const employerMap = new Map(); // companyName -> employerId

    for (const empData of demoEmployers) {
      summary.employers.processed += 1;
      let existingUser = await User.findOne({ email: empData.email });

      if (existingUser) {
        summary.employers.existing += 1;
        employerMap.set(empData.companyName, existingUser._id);
      } else {
        const newUser = await User.create({
          name: empData.name,
          email: empData.email,
          password: empData.password,
          role: 'employer',
          isVerified: true,
          title: empData.title,
          location: empData.location,
          avatar: empData.avatar,
        });
        summary.employers.created += 1;
        employerMap.set(empData.companyName, newUser._id);
      }
    }

    // 3. Safe upsert of Indian Companies by unique name
    const companyMap = new Map(); // companyName -> company Document

    for (const compData of indianCompaniesData) {
      summary.companies.processed += 1;
      const employerId = employerMap.get(compData.name);

      const existingComp = await Company.findOne({ name: compData.name });

      if (existingComp) {
        // Update details without replacing ID or destroying references
        existingComp.logoUrl = compData.logoUrl;
        existingComp.bannerUrl = compData.bannerUrl;
        existingComp.description = compData.description;
        existingComp.culture = compData.culture;
        existingComp.website = compData.website;
        existingComp.location = compData.location;
        existingComp.industry = compData.industry;
        existingComp.size = compData.size;
        existingComp.foundedYear = compData.foundedYear;
        existingComp.stage = compData.stage;
        if (employerId && !existingComp.employerId) {
          existingComp.employerId = employerId;
        }
        await existingComp.save();
        summary.companies.updated += 1;
        companyMap.set(compData.name, existingComp);
      } else {
        const newComp = await Company.create({
          ...compData,
          employerId: employerId || new mongoose.Types.ObjectId(),
        });
        summary.companies.created += 1;
        companyMap.set(compData.name, newComp);
      }

      // Link company to employer profile if employer exists
      if (employerId) {
        await User.findByIdAndUpdate(employerId, { companyId: companyMap.get(compData.name)._id });
      }
    }

    // 4. Safe upsert of Indian Jobs by title and companyId
    for (const jobData of indianJobsData) {
      summary.jobs.processed += 1;
      const company = companyMap.get(jobData.companyName);

      if (!company) {
        console.warn(`[Seed:India] Warning: Company '${jobData.companyName}' not found for job '${jobData.title}'.`);
        continue;
      }

      const employerId = employerMap.get(jobData.companyName) || company.employerId;

      const filter = {
        title: jobData.title,
        companyId: company._id,
      };

      const updateData = {
        title: jobData.title,
        companyId: company._id,
        postedBy: employerId,
        category: jobData.category,
        jobType: jobData.jobType,
        experienceLevel: jobData.experienceLevel,
        workplaceType: jobData.workplaceType,
        location: jobData.location,
        salaryMin: jobData.salaryMin,
        salaryMax: jobData.salaryMax,
        salaryCurrency: jobData.salaryCurrency,
        salaryPeriod: jobData.salaryPeriod,
        featured: jobData.featured,
        skillsRequired: jobData.skillsRequired,
        description: jobData.description,
        responsibilities: jobData.responsibilities,
        requirements: jobData.requirements,
        status: 'Active',
      };

      const existingJob = await Job.findOne(filter);

      if (existingJob) {
        await Job.updateOne(filter, { $set: updateData });
        summary.jobs.updated += 1;
      } else {
        await Job.create(updateData);
        summary.jobs.created += 1;
      }
    }

    // 5. Ensure core taxonomies exist safely
    const indianCategories = [
      'Development',
      'Design',
      'Data',
      'DevOps & Infrastructure',
      'Management',
      'Marketing',
    ];
    for (const cat of indianCategories) {
      await Taxonomy.findOneAndUpdate(
        { name: cat, type: 'category' },
        { $setOnInsert: { name: cat, type: 'category' } },
        { upsert: true }
      );
    }

    const indianTags = [
      'React',
      'Node.js',
      'TypeScript',
      'Python',
      'Java',
      'AWS',
      'Kubernetes',
      'Figma',
      'Cybersecurity',
      'Machine Learning',
      'FastAPI',
      'Spring Boot',
    ];
    for (const tag of indianTags) {
      await Taxonomy.findOneAndUpdate(
        { name: tag, type: 'tag' },
        { $setOnInsert: { name: tag, type: 'tag' } },
        { upsert: true }
      );
    }

    // 6. Post-check candidate count
    const postCandidatesCount = await User.countDocuments({ role: 'candidate' });
    console.log(`[Seed:India] Safety Verification: Initial candidates=${existingCandidatesCount}, Post-seed candidates=${postCandidatesCount}.`);
    if (postCandidatesCount !== existingCandidatesCount) {
      throw new Error(`CRITICAL INTEGRITY FAILURE: Candidate count changed from ${existingCandidatesCount} to ${postCandidatesCount}!`);
    }

    console.log('[Seed:India] Seeding successfully completed without destructive operations.');
    return summary;
  } catch (err) {
    console.error('[Seed:India] Error during seeding:', err);
    throw err;
  }
};

// If invoked directly from terminal
if (process.argv[1] && process.argv[1].endsWith('seedIndia.js')) {
  (async () => {
    try {
      await connectDB();
      const isDry = process.argv.includes('--dry-run');
      const results = await seedIndiaDatabase({ isDryRun: isDry });
      console.log('\n========================================');
      console.log('  CAREERCONNECT INDIA SEEDING REPORT');
      console.log('========================================');
      console.log(`Database:            ${results.targetDatabase}`);
      console.log(`Mode:                ${results.isDryRun ? 'DRY-RUN' : 'LIVE MUTATION'}`);
      console.log(`Companies:           ${results.companies.processed} (Created: ${results.companies.created}, Updated: ${results.companies.updated})`);
      console.log(`Jobs:                ${results.jobs.processed} (Created: ${results.jobs.created}, Updated: ${results.jobs.updated})`);
      console.log(`Employers:           ${results.employers.processed} (Created: ${results.employers.created}, Preserved: ${results.employers.existing})`);
      console.log(`Candidates Intact:   ${results.candidatesUntouched}`);
      console.log('========================================\n');
      await closeDB();
      process.exit(0);
    } catch (err) {
      console.error('[Seed:India] Fatal Error:', err);
      await closeDB();
      process.exit(1);
    }
  })();
}
