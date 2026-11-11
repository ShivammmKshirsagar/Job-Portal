import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import Application from '../models/Application.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { emitNotification } from '../sockets/socketHandler.js';
import { persistUploadedFile, getUploadsDir } from '../utils/fileStorage.js';

// @desc    Apply to a job
// @route   POST /api/applications/:jobId
// @access  Private (Candidate)
export const applyToJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { coverNote, portfolioUrl } = req.body;

    const job = await Job.findById(jobId).populate('companyId');
    if (!job || job.status === 'Closed') {
      return res.status(404).json({
        success: false,
        message: 'This job is no longer accepting applications.',
      });
    }

    // Check for duplicate application
    const existing = await Application.findOne({
      jobId,
      candidateId: req.user._id,
    });

    if (existing && existing.status !== 'Withdrawn') {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted an active application for this position.',
      });
    }

    // Determine resume URL
    let resumeUrl = req.user.resumeUrl;
    let resumeOriginalName = req.user.resumeOriginalName;

    if (req.file) {
      resumeUrl = `/uploads/${req.file.filename}`;
      resumeOriginalName = req.file.originalname;

      // Persist uploaded file to MongoDB Atlas for persistence across restarts
      await persistUploadedFile(req.file, req.user._id);

      // Update candidate's default resume if not set
      if (!req.user.resumeUrl) {
        req.user.resumeUrl = resumeUrl;
        req.user.resumeOriginalName = resumeOriginalName;
        await req.user.save();
      }
    } else if (req.user.resumeUrl) {
      // If applying with profile resume, create an application-specific copy to decouple application attachment from profile resume
      try {
        const sourceBasename = path.basename(req.user.resumeUrl);
        const uploadsDir = getUploadsDir();
        const possibleDirs = [
          uploadsDir,
          process.env.UPLOAD_PATH ? path.resolve(process.env.UPLOAD_PATH) : null,
          path.resolve('uploads'),
          path.resolve('server/uploads'),
        ].filter(Boolean);

        for (const dir of possibleDirs) {
          const sourcePath = path.join(dir, sourceBasename);
          if (fs.existsSync(sourcePath)) {
            const ext = path.extname(sourceBasename) || '.pdf';
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const appFilename = `app-resume-${uniqueSuffix}${ext}`;
            const targetPath = path.join(dir, appFilename);
            await fs.promises.copyFile(sourcePath, targetPath);
            resumeUrl = `/uploads/${appFilename}`;
            break;
          }
        }
      } catch (copyErr) {
        console.warn('Could not copy profile resume for application, using profile reference:', copyErr.message);
      }
    } else if (existing && existing.resumeUrl) {
      // Re-use candidate's previously submitted application resume
      resumeUrl = existing.resumeUrl;
      resumeOriginalName = existing.resumeOriginalName;
    }

    if (!resumeUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a resume or add a resume to your profile before applying.',
      });
    }

    // If candidate previously withdrew this application, re-activate and update it
    if (existing && existing.status === 'Withdrawn') {
      existing.resumeUrl = resumeUrl;
      existing.resumeOriginalName = resumeOriginalName || existing.resumeOriginalName || 'Candidate_Resume.pdf';
      existing.coverNote = coverNote || '';
      existing.portfolioUrl = portfolioUrl || '';
      existing.status = 'Applied';
      existing.appliedAt = new Date();
      await existing.save();

      // Notify the employer / job poster
      if (job.postedBy) {
        const notif = await Notification.create({
          recipient: job.postedBy,
          sender: req.user._id,
          type: 'new_application',
          title: 'Application Re-submitted',
          message: `${req.user.name} has re-submitted their application for "${job.title}".`,
          link: '/employer/dashboard',
        });
        emitNotification(job.postedBy, notif);
      }

      const populatedApp = await Application.findById(existing._id)
        .populate({
          path: 'jobId',
          populate: { path: 'companyId' },
        })
        .populate('candidateId', 'name email avatar skills location');

      return res.status(200).json({
        success: true,
        message: 'Application re-submitted successfully!',
        application: populatedApp,
      });
    }

    const application = await Application.create({
      jobId,
      candidateId: req.user._id,
      resumeUrl,
      resumeOriginalName,
      coverNote: coverNote || '',
      portfolioUrl: portfolioUrl || '',
      status: 'Applied',
    });

    // Notify the employer / job poster
    const notif = await Notification.create({
      recipient: job.postedBy,
      sender: req.user._id,
      type: 'new_application',
      title: 'New Applicant Received',
      message: `${req.user.name} applied for "${job.title}".`,
      link: '/employer/dashboard',
    });

    emitNotification(job.postedBy, notif);

    const populatedApp = await Application.findById(application._id)
      .populate({
        path: 'jobId',
        populate: { path: 'companyId' },
      })
      .populate('candidateId', 'name email avatar skills location');

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully!',
      application: populatedApp,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all applications of current candidate (Candidate Dashboard Fig 8.4)
// @route   GET /api/applications/candidate/my-applications
// @access  Private (Candidate)
export const getCandidateApplications = async (req, res, next) => {
  try {
    const applications = await Application.find({ candidateId: req.user._id })
      .populate({
        path: 'jobId',
        populate: [
          { path: 'companyId', select: 'name logoUrl location employerId' },
          { path: 'postedBy', select: 'name email avatar' },
        ],
      })
      .sort({ appliedAt: -1 });

    // Calculate metrics for dashboard from authenticated user's actual records
    const totalApps = applications.length;
    const activeApps = applications.filter(
      (app) => !['Withdrawn', 'Rejected'].includes(app.status)
    ).length;
    const inReview = applications.filter((app) => app.status === 'In Review').length;
    const shortlisted = applications.filter(
      (app) => app.status === 'Shortlisted' || app.status === 'Interview'
    ).length;
    const rejected = applications.filter((app) => app.status === 'Rejected').length;
    const withdrawn = applications.filter((app) => app.status === 'Withdrawn').length;

    // Fetch actual saved jobs count for this authenticated candidate
    const candidateUser = await User.findById(req.user._id).select('savedJobs');
    const savedJobs = Array.isArray(candidateUser?.savedJobs) ? candidateUser.savedJobs.length : 0;

    res.status(200).json({
      success: true,
      metrics: {
        totalApps,
        activeApps,
        inReview,
        shortlisted,
        rejected,
        withdrawn,
        savedJobs,
      },
      applications,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all applications for a job (Employer Dashboard)
// @route   GET /api/applications/job/:jobId
// @access  Private (Employer / Admin)
export const getJobApplications = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found.',
      });
    }

    if (
      req.user.role !== 'admin' &&
      job.postedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized.',
      });
    }

    const applications = await Application.find({ jobId })
      .populate('candidateId', 'name email avatar skills location phone bio resumeUrl')
      .populate('jobId', 'title')
      .sort({ appliedAt: -1 });

    res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update application status (Employer / Admin)
// @route   PATCH /api/applications/:id/status
// @access  Private (Employer / Admin)
export const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Applied', 'In Review', 'Shortlisted', 'Rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const application = await Application.findById(req.params.id)
      .populate('jobId')
      .populate('candidateId', 'name email');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.',
      });
    }

    // Verify ownership
    if (
      req.user.role !== 'admin' &&
      application.jobId.postedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this application.',
      });
    }

    if (application.status === 'Withdrawn') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update the status of an application that has been withdrawn by the candidate.',
      });
    }

    application.status = status;
    await application.save();

    // Trigger persistent notification and real-time socket alert to candidate
    const notif = await Notification.create({
      recipient: application.candidateId._id,
      sender: req.user._id,
      type: 'application_status',
      title: 'Application Status Updated',
      message: `Your application for "${application.jobId.title}" is now "${status}".`,
      link: '/candidate/dashboard',
    });

    emitNotification(application.candidateId._id, notif);

    res.status(200).json({
      success: true,
      message: `Application status updated to ${status}.`,
      application,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Withdraw a candidate application
// @route   PATCH /api/applications/:id/withdraw
// @access  Private (Candidate)
export const withdrawApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application ID format.',
      });
    }

    const application = await Application.findById(id).populate('jobId');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.',
      });
    }

    // Strictly enforce ownership: only candidate who owns the application can withdraw it
    if (application.candidateId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. You can only withdraw your own applications.',
      });
    }

    // Prevent withdrawing an already withdrawn application
    if (application.status === 'Withdrawn') {
      return res.status(400).json({
        success: false,
        message: 'This application has already been withdrawn.',
      });
    }

    // Do not allow candidates to withdraw applications that have already been rejected, accepted, or otherwise finalized
    const nonWithdrawable = ['Rejected', 'Accepted', 'Hired'];
    if (nonWithdrawable.includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot withdraw an application that has already been finalized as "${application.status}".`,
      });
    }

    // Allow withdrawal from active stages: 'Applied', 'In Review', 'Shortlisted', 'Interview'
    const eligibleStages = ['Applied', 'In Review', 'Shortlisted', 'Interview'];
    if (!eligibleStages.includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: `Application cannot be withdrawn at its current stage: ${application.status}.`,
      });
    }

    // Update status to Withdrawn without deleting record or attachments
    application.status = 'Withdrawn';
    await application.save();

    // Notify the employer / job poster in real time and persist notification
    if (application.jobId?.postedBy) {
      const notif = await Notification.create({
        recipient: application.jobId.postedBy,
        sender: req.user._id,
        type: 'application_status',
        title: 'Application Withdrawn',
        message: `${req.user.name} has withdrawn their application for "${application.jobId.title}".`,
        link: '/employer/dashboard',
      });
      emitNotification(application.jobId.postedBy, notif);
    }

    res.status(200).json({
      success: true,
      message: 'Application withdrawn successfully.',
      application,
    });
  } catch (err) {
    next(err);
  }
};

