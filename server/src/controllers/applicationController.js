import Application from '../models/Application.js';
import Job from '../models/Job.js';
import Notification from '../models/Notification.js';
import { emitNotification } from '../sockets/socketHandler.js';

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

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted an application for this position.',
      });
    }

    // Determine resume URL
    let resumeUrl = req.user.resumeUrl;
    let resumeOriginalName = req.user.resumeOriginalName;

    if (req.file) {
      resumeUrl = `/uploads/${req.file.filename}`;
      resumeOriginalName = req.file.originalname;

      // Update candidate's default resume if not set
      if (!req.user.resumeUrl) {
        req.user.resumeUrl = resumeUrl;
        req.user.resumeOriginalName = resumeOriginalName;
        await req.user.save();
      }
    }

    if (!resumeUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a resume or add a resume to your profile before applying.',
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
        populate: { path: 'companyId' },
      })
      .sort({ appliedAt: -1 });

    // Calculate metrics for dashboard
    const totalApps = applications.length;
    const inReview = applications.filter((app) => app.status === 'In Review').length;
    const shortlisted = applications.filter((app) => app.status === 'Shortlisted').length;
    const rejected = applications.filter((app) => app.status === 'Rejected').length;

    res.status(200).json({
      success: true,
      metrics: {
        totalApps,
        inReview,
        shortlisted,
        rejected,
        savedJobs: 8, // sample saved jobs metric
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

