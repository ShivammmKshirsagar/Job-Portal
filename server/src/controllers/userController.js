import User from '../models/User.js';
import Job from '../models/Job.js';

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

