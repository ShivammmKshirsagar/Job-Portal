import path from 'path';
import fs from 'fs';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Application from '../models/Application.js';

// @desc    Update candidate/user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'title', 'location', 'bio', 'skills', 'phone', 'avatar'];
    const updates = {};

    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).populate('companyId');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload candidate resume
// @route   POST /api/users/resume
// @access  Private (Candidate)
export const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a file to upload.',
      });
    }

    const resumeUrl = `/uploads/${req.file.filename}`;
    const resumeOriginalName = req.file.originalname;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        resumeUrl,
        resumeOriginalName,
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Resume uploaded successfully.',
      resumeUrl,
      resumeOriginalName,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete candidate resume from active profile
// @route   DELETE /api/users/resume
// @access  Private (Candidate)
export const deleteResume = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    if (!user.resumeUrl) {
      return res.status(400).json({
        success: false,
        message: 'No resume is currently uploaded to delete.',
      });
    }

    const currentResumeUrl = user.resumeUrl;

    // Remove or clear the corresponding resume reference from the user's profile
    user.resumeUrl = '';
    user.resumeOriginalName = '';
    await user.save();

    // Check if this file is referenced in any historical application attachment
    // If an application references this file, preserve it on disk!
    const isReferencedInApplications = await Application.exists({
      resumeUrl: currentResumeUrl,
    });

    // If NOT referenced by any application, safely delete the physical file from disk
    if (!isReferencedInApplications) {
      try {
        const filename = path.basename(currentResumeUrl);
        // Prevent directory traversal: filename must be a simple file basename
        if (
          filename &&
          filename !== '.' &&
          filename !== '..' &&
          !filename.includes('/') &&
          !filename.includes('\\')
        ) {
          const possibleDirs = [
            process.env.UPLOAD_PATH ? path.resolve(process.env.UPLOAD_PATH) : null,
            path.resolve('uploads'),
            path.resolve('server/uploads'),
          ].filter(Boolean);

          for (const dir of possibleDirs) {
            const filePath = path.join(dir, filename);
            // Ensure resolved path stays strictly within the directory
            if (filePath.startsWith(dir) && fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        }
      } catch (fileErr) {
        console.warn('Physical file deletion error (ignored for safety):', fileErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Resume deleted successfully from your profile.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        resumeUrl: user.resumeUrl,
        resumeOriginalName: user.resumeOriginalName,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Public
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('companyId');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle saving a job for authenticated candidate
// @route   POST /api/users/saved-jobs/:jobId
// @access  Private (Candidate)
export const toggleSaveJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    // Validate job existence
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found.',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (!Array.isArray(user.savedJobs)) {
      user.savedJobs = [];
    }

    const isAlreadySaved = user.savedJobs.some((id) => id.toString() === jobId.toString());

    if (isAlreadySaved) {
      user.savedJobs = user.savedJobs.filter((id) => id.toString() !== jobId.toString());
    } else {
      user.savedJobs.push(job._id);
    }

    await user.save();

    res.status(200).json({
      success: true,
      isSaved: !isAlreadySaved,
      savedJobsCount: user.savedJobs.length,
      savedJobs: user.savedJobs,
      message: !isAlreadySaved ? 'Job saved successfully.' : 'Job removed from saved jobs.',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all saved jobs for authenticated candidate
// @route   GET /api/users/saved-jobs
// @access  Private (Candidate)
export const getSavedJobs = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'savedJobs',
      populate: { path: 'companyId' },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.status(200).json({
      success: true,
      count: user.savedJobs?.length || 0,
      savedJobs: user.savedJobs || [],
    });
  } catch (err) {
    next(err);
  }
};

