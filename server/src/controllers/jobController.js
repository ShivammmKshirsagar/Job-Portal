import Job from '../models/Job.js';
import Application from '../models/Application.js';
import Company from '../models/Company.js';

// @desc    Get all jobs with search, filtering, sorting and pagination
// @route   GET /api/jobs
// @access  Public
export const getJobs = async (req, res, next) => {
  try {
    const {
      search,
      category,
      jobType,
      experienceLevel,
      location,
      salaryMin,
      salaryMax,
      sort,
      page = 1,
      limit = 10,
    } = req.query;

    const query = { status: 'Active' };

    // Search keyword across title, skills, description
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { skillsRequired: { $in: [searchRegex] } },
        { location: searchRegex },
      ];
    }

    // Category filter
    if (category && category !== 'All') {
      query.category = category;
    }

    // Job Type filter
    if (jobType && jobType !== 'All') {
      query.jobType = jobType;
    }

    // Experience Level filter
    if (experienceLevel && experienceLevel !== 'All') {
      query.experienceLevel = experienceLevel;
    }

    // Location filter
    if (location && location.trim() !== '') {
      query.location = new RegExp(location.trim(), 'i');
    }

    // Salary filters
    if (salaryMin) {
      query.salaryMax = { $gte: Number(salaryMin) };
    }
    if (salaryMax) {
      query.salaryMin = { ...query.salaryMin, $lte: Number(salaryMax) };
    }

    // Sorting
    let sortOptions = { createdAt: -1 }; // default: most recent
    if (sort === 'salary-desc') {
      sortOptions = { salaryMax: -1 };
    } else if (sort === 'salary-asc') {
      sortOptions = { salaryMin: 1 };
    } else if (sort === 'oldest') {
      sortOptions = { createdAt: 1 };
    }

    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .populate('companyId', 'name logoUrl location website size industry')
      .populate('postedBy', 'name email avatar')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: jobs.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      jobs,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get featured jobs for homepage
// @route   GET /api/jobs/featured
// @access  Public
export const getFeaturedJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({ status: 'Active', featured: true })
      .populate('companyId', 'name logoUrl location website size')
      .limit(6);

    res.status(200).json({
      success: true,
      count: jobs.length,
      jobs,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single job by ID
// @route   GET /api/jobs/:id
// @access  Public
export const getJobById = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('companyId')
      .populate('postedBy', 'name email avatar');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found.',
      });
    }

    // Also get related jobs by same category or company
    const relatedJobs = await Job.find({
      _id: { $ne: job._id },
      status: 'Active',
      $or: [{ category: job.category }, { companyId: job.companyId }],
    })
      .populate('companyId', 'name logoUrl location')
      .limit(3);

    // If user is authenticated, check if candidate already applied
    let hasApplied = false;
    let applicationStatus = null;
    if (req.user && req.user.role === 'candidate') {
      const application = await Application.findOne({
        jobId: job._id,
        candidateId: req.user._id,
      });
      if (application) {
        hasApplied = true;
        applicationStatus = application.status;
      }
    }

    res.status(200).json({
      success: true,
      job,
      relatedJobs,
      hasApplied,
      applicationStatus,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create a new job posting
// @route   POST /api/jobs
// @access  Private (Employer / Admin)
export const createJob = async (req, res, next) => {
  try {
    let companyId = req.user.companyId;

    // If company not linked yet, find or create one
    if (!companyId) {
      let company = await Company.findOne({ employerId: req.user._id });
      if (!company) {
        company = await Company.create({
          name: req.body.companyName || `${req.user.name}'s Company`,
          employerId: req.user._id,
          location: req.body.location || 'Remote',
        });
      }
      companyId = company._id;
      req.user.companyId = companyId;
      await req.user.save();
    }

    const jobData = {
      ...req.body,
      companyId,
      postedBy: req.user._id,
    };

    const job = await Job.create(jobData);
    const populatedJob = await Job.findById(job._id).populate('companyId');

    res.status(201).json({
      success: true,
      message: 'Job posting created successfully.',
      job: populatedJob,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update a job posting
// @route   PUT /api/jobs/:id
// @access  Private (Employer / Admin)
export const updateJob = async (req, res, next) => {
  try {
    let job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found.',
      });
    }

    // Verify ownership if not admin
    if (
      req.user.role !== 'admin' &&
      job.postedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this job posting.',
      });
    }

    job = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('companyId');

    res.status(200).json({
      success: true,
      message: 'Job posting updated successfully.',
      job,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a job posting
// @route   DELETE /api/jobs/:id
// @access  Private (Employer / Admin)
export const deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found.',
      });
    }

    if (
      req.user.role !== 'admin' &&
      job.postedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this job posting.',
      });
    }

    await Job.findByIdAndDelete(req.params.id);
    await Application.deleteMany({ jobId: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Job posting and associated applications removed.',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle job status (Active / Closed)
// @route   PATCH /api/jobs/:id/status
// @access  Private (Employer / Admin)
export const toggleJobStatus = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);

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

    job.status = job.status === 'Active' ? 'Closed' : 'Active';
    await job.save();

    res.status(200).json({
      success: true,
      message: `Job status changed to ${job.status}.`,
      job,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get jobs posted by the logged-in employer
// @route   GET /api/jobs/employer/my-jobs
// @access  Private (Employer)
export const getEmployerJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({ postedBy: req.user._id })
      .populate('companyId')
      .sort({ createdAt: -1 });

    // Attach applicant count to each job
    const jobsWithCounts = await Promise.all(
      jobs.map(async (job) => {
        const applicantCount = await Application.countDocuments({ jobId: job._id });
        return {
          ...job.toObject(),
          applicantCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: jobsWithCounts.length,
      jobs: jobsWithCounts,
    });
  } catch (err) {
    next(err);
  }
};

