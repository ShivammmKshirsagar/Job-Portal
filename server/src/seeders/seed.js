import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Company from '../models/Company.js';
import Job from '../models/Job.js';
import Application from '../models/Application.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import Taxonomy from '../models/Taxonomy.js';
import { connectDB, closeDB } from '../config/db.js';

dotenv.config();

// Helper to ensure sample PDF resumes exist on disk
export const ensureSampleResumesExist = () => {
  const uploadsDir = path.resolve('uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const alexPdf = path.join(uploadsDir, 'sample_resume_alex_rivera.pdf');
  if (!fs.existsSync(alexPdf)) {
    const content = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 130 >>\nstream\nBT\n/F1 18 Tf\n50 720 Td\n(Alex Rivera - Senior Frontend Engineer) Tj\n/F1 12 Tf\n0 -30 Td\n(Skills: React, TypeScript, Tailwind CSS, Next.js, Redux, GraphQL) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000425 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n504\n%%EOF`;
    fs.writeFileSync(alexPdf, content);
  }

  const davidPdf = path.join(uploadsDir, 'sample_resume_david_chen.pdf');
  if (!fs.existsSync(davidPdf)) {
    const content = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 135 >>\nstream\nBT\n/F1 18 Tf\n50 720 Td\n(David Chen - Data Scientist & ML Engineer) Tj\n/F1 12 Tf\n0 -30 Td\n(Skills: Python, PyTorch, TensorFlow, SQL, FastAPI, Pandas) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000430 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n509\n%%EOF`;
    fs.writeFileSync(davidPdf, content);
  }

  const prepGuidePdf = path.join(uploadsDir, 'Interview_Prep_Guide.pdf');
  if (!fs.existsSync(prepGuidePdf)) {
    const content = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 130 >>\nstream\nBT\n/F1 18 Tf\n50 720 Td\n(CareerConnect - Technical Interview Preparation Guide) Tj\n/F1 12 Tf\n0 -30 Td\n(Comprehensive preparation tips, coding exercises, and behavioral frameworks.) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000425 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n504\n%%EOF`;
    fs.writeFileSync(prepGuidePdf, content);
  }
};

export const seedDatabase = async () => {
  try {
    await connectDB();
    ensureSampleResumesExist();
    console.log('[Seeder] Cleaning existing database collections...');

    await User.deleteMany();
    await Company.deleteMany();
    await Job.deleteMany();
    await Application.deleteMany();
    await Message.deleteMany();
    await Notification.deleteMany();
    await Taxonomy.deleteMany();

    console.log('[Seeder] Creating admin, employers, and candidates...');

    // 1. Create Admin
    const admin = await User.create({
      name: 'CareerConnect Admin',
      email: 'admin@careerconnect.com',
      password: 'AdminPassword123!',
      role: 'admin',
      isVerified: true,
      title: 'Platform Administrator',
      location: 'Global',
    });

    // 2. Create Employers
    const employer1 = await User.create({
      name: 'Sarah Jenkins',
      email: 'recruiter@technova.com',
      password: 'EmployerPassword123!',
      role: 'employer',
      isVerified: true,
      title: 'Head of Talent Acquisition',
      location: 'San Francisco, CA',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    });

    const employer2 = await User.create({
      name: 'Michael Kim',
      email: 'recruiter@apex.com',
      password: 'EmployerPassword123!',
      role: 'employer',
      isVerified: true,
      title: 'Senior Engineering Manager',
      location: 'New York, NY',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    });

    // 3. Create Companies
    const companyTechNova = await Company.create({
      name: 'TechNova Solutions',
      logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
      description: 'At TechNova Solutions, we build the operational nervous system for modern enterprises. We believe that powerful enterprise software should be intuitive, seamlessly integrated, and genuinely enjoyable to use.',
      culture: 'Engineering excellence, radical transparency, customer obsession, and high psychological safety.',
      website: 'https://technovasolutions.io',
      location: 'San Francisco, CA',
      industry: 'Enterprise Software',
      size: '500-1000 Employees',
      foundedYear: 2015,
      stage: 'Series B',
      employerId: employer1._id,
    });

    const companyApex = await Company.create({
      name: 'Apex Digital Agency',
      logoUrl: 'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=128&auto=format&fit=crop&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&auto=format&fit=crop&q=80',
      description: 'Apex Digital is a creative engineering power-house building bleeding-edge web applications, brand identities, and high-performance design systems for global brands.',
      website: 'https://apexdigital.design',
      location: 'New York, NY',
      industry: 'Design & Marketing',
      size: '50-200 Employees',
      foundedYear: 2019,
      stage: 'Growth',
      employerId: employer2._id,
    });

    const companySeyfert = await Company.create({
      name: 'Seyfert Corp',
      logoUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=128&auto=format&fit=crop&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&auto=format&fit=crop&q=80',
      description: 'Seyfert Corp is transforming algorithmic fintech and real-time financial data infrastructure with ultra-low latency streaming analytics.',
      website: 'https://seyfertcorp.fintech',
      location: 'Austin, TX',
      industry: 'FinTech',
      size: '1000-5000 Employees',
      foundedYear: 2012,
      stage: 'Public',
      employerId: employer1._id,
    });

    const companyAcme = await Company.create({
      name: 'Acme Corp',
      logoUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=128&auto=format&fit=crop&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1200&auto=format&fit=crop&q=80',
      description: 'Acme Corporation designs and operates hyperscale AI infrastructure and resilient global cloud compute platforms.',
      website: 'https://acmecorp.cloud',
      location: 'San Francisco, CA',
      industry: 'Cloud Infrastructure',
      size: '10,000+ Employees',
      foundedYear: 2008,
      stage: 'Public',
      employerId: employer2._id,
    });

    const companyGlobex = await Company.create({
      name: 'Globex Inc',
      logoUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=128&auto=format&fit=crop&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&auto=format&fit=crop&q=80',
      description: 'Globex Inc develops modern consumer technology hardware and lifestyle software applications connecting millions worldwide.',
      website: 'https://globexglobal.com',
      location: 'New York, NY',
      industry: 'Consumer Tech',
      size: '1,000-10,000 Employees',
      foundedYear: 2011,
      stage: 'Series C',
      employerId: employer1._id,
    });

    // Link companies back to employers
    employer1.companyId = companyTechNova._id;
    await employer1.save();
    employer2.companyId = companyApex._id;
    await employer2.save();

    // 4. Create Candidates
    // Alex Rivera - Main candidate matching Figure 8.4 Candidate Dashboard
    const alex = await User.create({
      name: 'Alex Rivera',
      email: 'alex@careerconnect.com',
      password: 'CandidatePassword123!',
      role: 'candidate',
      isVerified: true,
      title: 'Senior Frontend Engineer',
      location: 'San Francisco, CA',
      skills: ['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Redux', 'GraphQL', 'Jest'],
      resumeUrl: '/uploads/sample_resume_alex_rivera.pdf',
      resumeOriginalName: 'Alex_Rivera_Resume_2026.pdf',
      bio: 'Full-stack frontend specialist with 5+ years of experience architecting large-scale React applications, state management architectures, and component libraries.',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    });

    const candidate2 = await User.create({
      name: 'David Chen',
      email: 'david@careerconnect.com',
      password: 'CandidatePassword123!',
      role: 'candidate',
      isVerified: true,
      title: 'Data Scientist & ML Engineer',
      location: 'Austin, TX',
      skills: ['Python', 'PyTorch', 'TensorFlow', 'SQL', 'FastAPI', 'Pandas'],
      resumeUrl: '/uploads/sample_resume_david_chen.pdf',
      resumeOriginalName: 'David_Chen_CV.pdf',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    });

    // Flagged users for Admin Moderation Queue (Fig 8.7)
    await User.create({
      name: 'Jane Doe',
      email: 'jane.flagged@example.com',
      password: 'TempPassword123!',
      role: 'candidate',
      isVerified: true,
      status: 'active',
      flagReason: 'Suspicious Profile',
      reportedBy: 'User Report',
    });

    await User.create({
      name: 'John Smith',
      email: 'john.duplicate@example.com',
      password: 'TempPassword123!',
      role: 'candidate',
      isVerified: true,
      status: 'active',
      flagReason: 'Duplicate Account',
      reportedBy: 'System (Automated)',
    });

    // 5. Create Jobs (matching Fig 8.1, 8.2, 8.3, 8.4, 8.5)
    const job1 = await Job.create({
      title: 'Senior Frontend Engineer',
      companyId: companyTechNova._id,
      postedBy: employer1._id,
      description: 'We are seeking a highly skilled and passionate Senior Frontend Engineer to join our core product team. In this role, you will be instrumental in architecting and building the next generation of our flagship SaaS dashboard used by thousands of enterprise clients globally. You will collaborate closely with product managers, designers, and backend engineers to deliver a seamless, high-performance, and visually stunning user experience.',
      responsibilities: [
        'Lead the technical design and implementation of new features within our React-based SPA.',
        'Mentor junior and mid-level engineers, fostering a culture of technical excellence and continuous learning.',
        'Optimize application performance for maximum speed and scalability across devices and browsers.',
        'Collaborate closely with the design team to refine UI/UX patterns and contribute to our internal design system.',
      ],
      requirements: [
        '5+ years of production experience building complex single-page applications with React.',
        'Proficiency in TypeScript, modern JavaScript (ES6+), HTML5, and responsive CSS (Tailwind).',
        'Strong understanding of client-side architecture, state management, and REST/WebSocket APIs.',
        'Demonstrated ability to write clean, maintainable, and well-tested code.',
      ],
      skillsRequired: ['React', 'TypeScript', 'Tailwind CSS', 'WebSockets', 'REST APIs'],
      jobType: 'Full-Time',
      experienceLevel: 'Senior Level',
      workplaceType: 'Hybrid',
      category: 'Development',
      salaryMin: 150000,
      salaryMax: 185000,
      location: 'San Francisco, CA (Hybrid)',
      featured: true,
      status: 'Active',
    });

    const job2 = await Job.create({
      title: 'Senior Product Designer',
      companyId: companyTechNova._id,
      postedBy: employer1._id,
      description: 'We are looking for a Senior Product Designer to lead the UX/UI strategy for our core enterprise platform. You will collaborate closely with engineering and product management to deliver intuitive, human-centered software interfaces.',
      responsibilities: [
        'Design wireframes, journey maps, user flows, and high-fidelity prototypes in Figma.',
        'Conduct usability testing sessions and distill qualitative insights into actionable roadmaps.',
        'Maintain and extend our unified multi-platform design token system.',
      ],
      requirements: [
        '4+ years designing B2B SaaS or consumer-facing digital products.',
        'Deep mastery of Figma, auto-layout, interactive prototyping, and design systems.',
        'Strong portfolio showcasing problem-solving and design iterations.',
      ],
      skillsRequired: ['Figma', 'UI/UX Design', 'Design Systems', 'User Research'],
      jobType: 'Full-Time',
      experienceLevel: 'Senior Level',
      workplaceType: 'Hybrid',
      category: 'Design',
      salaryMin: 140000,
      salaryMax: 180000,
      location: 'San Francisco, CA (Hybrid)',
      featured: true,
      status: 'Active',
    });

    const job3 = await Job.create({
      title: 'Frontend Developer (React)',
      companyId: companyApex._id,
      postedBy: employer2._id,
      description: 'Join our fast-paced agency environment building high-performance marketing sites and interactive web applications. Strong proficiency in React, TypeScript, and modern CSS frameworks is required.',
      responsibilities: [
        'Develop responsive web interfaces with animations and fluid interactions.',
        'Integrate headless CMS systems and third-party APIs.',
        'Ensure accessibility compliance and cross-browser consistency.',
      ],
      requirements: [
        '2+ years working with React and modern build tooling (Vite, Next.js).',
        'Strong grasp of CSS layout, flexbox, CSS grid, and Tailwind CSS.',
      ],
      skillsRequired: ['React', 'Tailwind CSS', 'JavaScript', 'HTML5'],
      jobType: 'Full-Time',
      experienceLevel: 'Mid Level',
      workplaceType: 'Remote',
      category: 'Development',
      salaryMin: 110000,
      salaryMax: 135000,
      location: 'Remote (US)',
      featured: true,
      status: 'Active',
    });

    const job4 = await Job.create({
      title: 'Product Designer',
      companyId: companyGlobex._id,
      postedBy: employer1._id,
      description: 'Globex is looking for a creative Product Designer to design next-generation consumer apps.',
      skillsRequired: ['Figma', 'Prototyping', 'Design Research'],
      jobType: 'Full-Time',
      experienceLevel: 'Mid Level',
      workplaceType: 'On-site',
      category: 'Design',
      salaryMin: 110000,
      salaryMax: 140000,
      location: 'New York, NY',
      featured: true,
      status: 'Active',
    });

    const job5 = await Job.create({
      title: 'Data Scientist',
      companyId: companySeyfert._id,
      postedBy: employer1._id,
      description: 'Seyfert Corp is hiring a Data Scientist to build predictive analytics models for real-time market data.',
      skillsRequired: ['Python', 'SQL', 'Machine Learning', 'Pandas'],
      jobType: 'Contract',
      experienceLevel: 'Mid Level',
      workplaceType: 'Hybrid',
      category: 'Data',
      salaryMin: 130000,
      salaryMax: 160000,
      location: 'Austin, TX',
      featured: true,
      status: 'Active',
    });

    const job6 = await Job.create({
      title: 'Product Manager, Core Platform',
      companyId: companyApex._id,
      postedBy: employer2._id,
      description: 'Lead the strategy, roadmap, and execution for our core developer and partner platform.',
      skillsRequired: ['Agile', 'Product Strategy', 'Analytics', 'Jira'],
      jobType: 'Full-Time',
      experienceLevel: 'Senior Level',
      workplaceType: 'Hybrid',
      category: 'Management',
      salaryMin: 140000,
      salaryMax: 170000,
      location: 'New York, NY',
      status: 'Active',
    });

    const job7 = await Job.create({
      title: 'Senior UX Designer',
      companyId: companyAcme._id,
      postedBy: employer2._id,
      description: 'Shape the developer experience for Acme Cloud Infrastructure tools.',
      skillsRequired: ['UX Design', 'Figma', 'Wireframing', 'Design Systems'],
      jobType: 'Full-Time',
      experienceLevel: 'Senior Level',
      workplaceType: 'Hybrid',
      category: 'Design',
      salaryMin: 135000,
      salaryMax: 165000,
      location: 'San Francisco, CA',
      status: 'Active',
    });

    const job8 = await Job.create({
      title: 'UI Developer',
      companyId: companyTechNova._id,
      postedBy: employer1._id,
      description: 'Build robust, reusable design components and frontend user experiences.',
      skillsRequired: ['React', 'CSS', 'JavaScript'],
      jobType: 'Full-Time',
      experienceLevel: 'Mid Level',
      workplaceType: 'Remote',
      category: 'Development',
      salaryMin: 90000,
      salaryMax: 115000,
      location: 'San Francisco, CA',
      status: 'Closed',
    });

    // 6. Create Applications matching Figure 8.4 for Alex Rivera
    await Application.create({
      jobId: job7._id, // Senior UX Designer at Acme Corp
      candidateId: alex._id,
      resumeUrl: alex.resumeUrl,
      resumeOriginalName: alex.resumeOriginalName,
      status: 'Shortlisted', // displays as "Interview"
      appliedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });

    await Application.create({
      jobId: job4._id, // Product Designer at Globex Inc
      candidateId: alex._id,
      resumeUrl: alex.resumeUrl,
      resumeOriginalName: alex.resumeOriginalName,
      status: 'In Review',
      appliedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    });

    await Application.create({
      jobId: job8._id, // UI Developer at TechNova
      candidateId: alex._id,
      resumeUrl: alex.resumeUrl,
      resumeOriginalName: alex.resumeOriginalName,
      status: 'Applied',
      appliedAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000),
    });

    // Additional application for Michael Kim / Apex
    await Application.create({
      jobId: job3._id, // Frontend Developer (React) at Apex
      candidateId: candidate2._id,
      resumeUrl: candidate2.resumeUrl,
      status: 'In Review',
      appliedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });

    // 7. Create Messages matching Figure 8.9 (Sarah Jenkins <-> Alex Rivera)
    await Message.create({
      senderId: employer1._id, // Sarah Jenkins
      receiverId: alex._id,
      jobId: job1._id,
      messageText:
        'Hi Alex! Thanks for applying to the Senior Frontend Engineer role. Your background with React and design systems looks very impressive.',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      isRead: true,
    });

    await Message.create({
      senderId: employer1._id,
      receiverId: alex._id,
      jobId: job1._id,
      messageText:
        'Are you available for a quick 15-minute chat sometime this week to discuss the role and your background in more detail?',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
      isRead: true,
    });

    await Message.create({
      senderId: alex._id,
      receiverId: employer1._id,
      jobId: job1._id,
      messageText:
        "Hi Sarah, thanks for reaching out! I'd love to chat. Yes, I have availability this Thursday afternoon or Friday morning. Let me know what works best for you.",
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      isRead: true,
    });

    await Message.create({
      senderId: employer1._id,
      receiverId: alex._id,
      jobId: job1._id,
      messageText:
        'Hi Alex, regarding your interview availability, Thursday at 2:00 PM PST works perfectly for me.',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      isRead: true,
    });

    await Message.create({
      senderId: employer1._id,
      receiverId: alex._id,
      jobId: job1._id,
      messageText:
        'Please review the attached interview preparation guide beforehand.',
      attachmentUrl: '/uploads/Interview_Prep_Guide.pdf',
      attachmentName: 'Interview_Prep_Guide.pdf',
      attachmentSize: '1.2 MB',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      isRead: false,
    });

    // Message thread with Michael Kim
    await Message.create({
      senderId: employer2._id, // Michael Kim
      receiverId: alex._id,
      jobId: job3._id,
      messageText: 'Thanks for sending over the portfolio. We are reviewing it today.',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      isRead: true,
    });

    // 8. Create Notifications
    await Notification.create({
      recipient: alex._id,
      sender: employer1._id,
      type: 'message',
      title: 'New message from Sarah Jenkins',
      message: 'Hi Alex, regarding your interview availability, Thursday at 2:00 PM...',
      link: '/messages',
      read: false,
    });

    await Notification.create({
      recipient: alex._id,
      sender: employer2._id,
      type: 'application_status',
      title: 'Application Status Updated',
      message: 'Your application status has changed to Shortlisted for Senior UX Designer at Acme Corp.',
      link: '/candidate/dashboard',
      read: true,
    });

    // 9. Create Taxonomy (Tags & Categories matching Fig 8.7)
    const initialTags = [
      'Prompt Engineering',
      'Web3',
      'Rust',
      'TypeScript',
      'React',
      'Tailwind CSS',
      'Python',
      'GraphQL',
    ];
    for (const tag of initialTags) {
      await Taxonomy.create({ name: tag, type: 'tag' });
    }

    const initialCategories = [
      'Software Development',
      'Data Science & Analytics',
      'Product Management',
      'UI/UX Design',
      'Marketing & Sales',
      'DevOps & Infrastructure',
    ];
    for (const cat of initialCategories) {
      await Taxonomy.create({ name: cat, type: 'category' });
    }

    console.log('[Seeder] Database successfully seeded with full production test data!');
    console.log('--- TEST ACCOUNTS CREATED ---');
    console.log('1. Admin: admin@careerconnect.com / AdminPassword123!');
    console.log('2. Recruiter (TechNova): recruiter@technova.com / EmployerPassword123!');
    console.log('3. Recruiter (Apex): recruiter@apex.com / EmployerPassword123!');
    console.log('4. Candidate (Alex): alex@careerconnect.com / CandidatePassword123!');
    console.log('5. Candidate (David): david@careerconnect.com / CandidatePassword123!');
  } catch (error) {
    console.error('[Seeder] Failed to seed database:', error);
    throw error;
  }
};

// If run directly from CLI
if (process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(async () => {
      await closeDB();
      process.exit(0);
    })
    .catch(async (err) => {
      await closeDB();
      process.exit(1);
    });
}

