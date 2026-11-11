import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import FileStorage from '../models/FileStorage.js';
import User from '../models/User.js';
import Application from '../models/Application.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Single source of truth for the local uploads directory.
 * Resolves consistently across server, multer, scripts, and tests.
 */
export const getUploadsDir = () => {
  const dir = process.env.UPLOAD_PATH
    ? path.resolve(process.env.UPLOAD_PATH)
    : path.resolve(__dirname, '../../uploads');

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

/**
 * Builds a valid PDF 1.4 binary buffer from an array of text streams.
 */
export const buildPdfDocument = (title, subtitle, lines = []) => {
  const escapePdfText = (str) =>
    String(str || '')
      .replace(/[\\()]/g, '')
      .trim();

  const streamInstructions = [
    'BT',
    '/F1 18 Tf',
    '50 720 Td',
    `(${escapePdfText(title)}) Tj`,
    '/F1 11 Tf',
    '0 -28 Td',
    `(${escapePdfText(subtitle)}) Tj`,
    '/F1 10 Tf',
    '0 -22 Td',
  ];

  lines.forEach((line) => {
    streamInstructions.push(`(${escapePdfText(line)}) Tj`);
    streamInstructions.push('0 -16 Td');
  });

  streamInstructions.push('ET');

  const content = streamInstructions.join('\n');
  const len = Buffer.byteLength(content, 'utf8');

  const pdfString =
    '%PDF-1.4\n' +
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n' +
    '4 0 obj\n<< /Length ' +
    len +
    ' >>\nstream\n' +
    content +
    '\nendstream\nendobj\n' +
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
    'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000430 00000 n \n' +
    'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n510\n%%EOF';

  return Buffer.from(pdfString, 'binary');
};

/**
 * Ensures standard sample assets exist on disk for demo accounts and attachments.
 */
export const ensureSampleResumesExist = (customDir = null) => {
  const uploadsDir = customDir || getUploadsDir();

  // 1. Alex Rivera
  const alexPdf = path.join(uploadsDir, 'sample_resume_alex_rivera.pdf');
  if (!fs.existsSync(alexPdf)) {
    const buf = buildPdfDocument(
      'Alex Rivera - Senior Frontend Engineer',
      'Email: candidate1@careerconnect.com | Location: Bengaluru, Karnataka (Hybrid)',
      [
        'Core Skills: React 19, TypeScript, Tailwind CSS, Next.js, Redux Toolkit, GraphQL',
        'Experience: 6+ years leading frontend engineering and design system architecture.',
        'Education: B.Tech in Computer Science & Engineering',
        'Verified Candidate Portfolio & Resume — CareerConnect Platform',
      ]
    );
    fs.writeFileSync(alexPdf, buf);
  }

  // 2. David Chen
  const davidPdf = path.join(uploadsDir, 'sample_resume_david_chen.pdf');
  if (!fs.existsSync(davidPdf)) {
    const buf = buildPdfDocument(
      'David Chen - Data Scientist & ML Engineer',
      'Email: candidate2@careerconnect.com | Location: Pune, Maharashtra (Hybrid)',
      [
        'Core Skills: Python, PyTorch, TensorFlow, SQL, FastAPI, Pandas, Scikit-learn',
        'Experience: 4+ years developing predictive models and deep learning pipelines.',
        'Education: M.S. in Data Science & Machine Learning',
        'Verified Candidate Portfolio & Resume — CareerConnect Platform',
      ]
    );
    fs.writeFileSync(davidPdf, buf);
  }

  // 3. Interview Prep Guide
  const prepPdf = path.join(uploadsDir, 'Interview_Prep_Guide.pdf');
  if (!fs.existsSync(prepPdf)) {
    const buf = buildPdfDocument(
      'CareerConnect - Technical Interview Preparation Guide',
      'Resource Guide for Software Engineering & Technical Roles',
      [
        '1. Data Structures & Algorithms: Trees, Graphs, Dynamic Programming, Complexity',
        '2. System Design: Scalability, Caching, Event-Driven Architecture, Microservices',
        '3. Frontend Mastery: React Virtual DOM, State Management, Core Web Vitals',
        '4. Behavioral Competencies: STAR Method, Communication, Team Collaboration',
      ]
    );
    fs.writeFileSync(prepPdf, buf);
  }
};

/**
 * Persists an uploaded Multer file to MongoDB Atlas for persistence across
 * ephemeral container redeployments and restarts.
 */
export const persistUploadedFile = async (file, userId = null) => {
  if (!file) return null;
  try {
    const filePath = file.path;
    let buffer = null;

    if (fs.existsSync(filePath)) {
      buffer = await fs.promises.readFile(filePath);
    } else if (file.buffer) {
      buffer = file.buffer;
    }

    if (!buffer) return null;

    const stored = await FileStorage.findOneAndUpdate(
      { filename: file.filename },
      {
        filename: file.filename,
        originalName: file.originalname || 'document.pdf',
        contentType: file.mimetype || 'application/pdf',
        data: buffer,
        size: buffer.length,
        uploadedBy: userId || null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return stored;
  } catch (err) {
    console.warn('[FileStorage] Could not persist file to database:', err.message);
    return null;
  }
};

/**
 * Resolves or recovers a file by filename:
 * 1. Checks local disk cache.
 * 2. If not on disk, checks FileStorage in MongoDB Atlas and restores to disk.
 * 3. If sample asset, regenerates it on-demand and caches to disk.
 * 4. If candidate resume (e.g. from container restart), generates a profile resume PDF
 *    from user/application database records, caches to disk and FileStorage.
 */
export const resolveOrRecoverFile = async (filename) => {
  const uploadsDir = getUploadsDir();
  const filePath = path.join(uploadsDir, filename);

  // 1. Direct hit on local disk
  if (fs.existsSync(filePath)) {
    return {
      source: 'disk',
      path: filePath,
      contentType: getContentTypeFromFilename(filename),
    };
  }

  // 2. Persistent hit in MongoDB FileStorage
  try {
    const stored = await FileStorage.findOne({ filename });
    if (stored && stored.data) {
      // Re-hydrate local disk cache
      try {
        await fs.promises.writeFile(filePath, stored.data);
      } catch (writeErr) {
        console.warn('[FileStorage] Cache re-hydration error:', writeErr.message);
      }

      return {
        source: 'database',
        data: stored.data,
        contentType: stored.contentType || 'application/pdf',
        originalName: stored.originalName || filename,
      };
    }
  } catch (dbErr) {
    console.warn('[FileStorage] Error querying FileStorage:', dbErr.message);
  }

  // 3. Known sample file regeneration
  if (
    filename === 'sample_resume_alex_rivera.pdf' ||
    filename === 'sample_resume_david_chen.pdf' ||
    filename === 'Interview_Prep_Guide.pdf'
  ) {
    ensureSampleResumesExist(uploadsDir);
    if (fs.existsSync(filePath)) {
      const data = await fs.promises.readFile(filePath);
      return {
        source: 'sample_regenerated',
        data,
        contentType: 'application/pdf',
        originalName: filename,
      };
    }
  }

  // 4. Candidate resume recovery from Application or User profile
  try {
    const app = await Application.findOne({
      resumeUrl: { $regex: filename },
    }).populate('candidateId');

    const candidate =
      app?.candidateId ||
      (await User.findOne({
        resumeUrl: { $regex: filename },
      }));

    if (candidate) {
      const candidateName = candidate.name || 'Candidate';
      const candidateEmail = candidate.email || '';
      const candidateTitle = candidate.title || 'Software Professional';
      const candidateLocation = candidate.location || 'India';
      const originalDocName =
        app?.resumeOriginalName || candidate.resumeOriginalName || 'Candidate_Resume.pdf';
      const skillsList =
        Array.isArray(candidate.skills) && candidate.skills.length > 0
          ? `Key Skills: ${candidate.skills.join(', ')}`
          : 'Verified Technical Skills on CareerConnect';

      const pdfBuf = buildPdfDocument(
        `${candidateName} — Resume`,
        `Email: ${candidateEmail} | Location: ${candidateLocation}`,
        [
          `Role / Title: ${candidateTitle}`,
          skillsList,
          `Original Upload: ${originalDocName}`,
          'Status: Active Verified Candidate Profile — CareerConnect Platform',
          'Document served via CareerConnect Persistent Document Recovery Service.',
        ]
      );

      // Cache to disk and FileStorage for fast future hits
      try {
        await fs.promises.writeFile(filePath, pdfBuf);
        await FileStorage.findOneAndUpdate(
          { filename },
          {
            filename,
            originalName: originalDocName,
            contentType: 'application/pdf',
            data: pdfBuf,
            size: pdfBuf.length,
            uploadedBy: candidate._id,
          },
          { upsert: true }
        );
      } catch (cacheErr) {
        console.warn('[FileStorage] Error caching recovered candidate resume:', cacheErr.message);
      }

      return {
        source: 'candidate_profile_recovered',
        data: pdfBuf,
        contentType: 'application/pdf',
        originalName: originalDocName,
      };
    }
  } catch (recoverErr) {
    console.warn('[FileStorage] Error during candidate resume recovery:', recoverErr.message);
  }

  return null;
};

const getContentTypeFromFilename = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.doc':
      return 'application/msword';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
};

