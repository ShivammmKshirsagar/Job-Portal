import Company from '../models/Company.js';
import Job from '../models/Job.js';
import User from '../models/User.js';

/**
 * Helper to reliably resolve the employer User account associated with a Company.
 * Checks: 1. company.employerId, 2. Job.postedBy for this company, 3. User with companyId.
 * Automatically links and persists employerId on the company if resolved.
 */
export const resolveEmployerForCompany = async (companyId) => {
  if (!companyId) return null;
  const company = await Company.findById(companyId);
  if (!company) return null;

  // 1. Direct company.employerId
  if (company.employerId) {
    const employer = await User.findById(company.employerId).select('_id name email avatar role title');
    if (employer && employer.status !== 'banned') return employer;
  }

  // 2. Active Job posted for this company
  const job = await Job.findOne({ companyId: company._id, postedBy: { $exists: true } });
  if (job?.postedBy) {
    const employer = await User.findById(job.postedBy).select('_id name email avatar role title');
    if (employer && employer.status !== 'banned') {
      company.employerId = employer._id;
      await company.save();
      return employer;
    }
  }

  // 3. User with matching companyId
  const user = await User.findOne({ companyId: company._id, role: 'employer', status: { $ne: 'banned' } }).select(
    '_id name email avatar role title'
  );
  if (user) {
    company.employerId = user._id;
    await company.save();
    return user;
  }

  return null;
};

// @desc    Get all companies with search and pagination
// @route   GET /api/companies
// @access  Public
export const getCompanies = async (req, res, next) => {
  try {
    const { search, industry } = req.query;
    const query = { status: 'active' };

    if (search && search.trim() !== '') {
      query.name = new RegExp(search.trim(), 'i');
    }

    if (industry && industry !== 'All') {
      query.industry = industry;
    }

    const companies = await Company.find(query).sort({ createdAt: -1 });

    // Include open jobs count for each company
    const companiesWithJobCount = await Promise.all(
      companies.map(async (company) => {
        const openRoles = await Job.countDocuments({
          companyId: company._id,
          status: 'Active',
        });
        return {
          ...company.toObject(),
          openRoles,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: companiesWithJobCount.length,
      companies: companiesWithJobCount,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get top hiring companies for homepage
// @route   GET /api/companies/top-hiring
// @access  Public
export const getTopHiringCompanies = async (req, res, next) => {
  try {
    const companies = await Company.find({ status: 'active' }).limit(4);

    const companiesWithCount = await Promise.all(
      companies.map(async (company) => {
        const openRoles = await Job.countDocuments({
          companyId: company._id,
          status: 'Active',
        });
        return {
          ...company.toObject(),
          openRoles,
        };
      })
    );

    res.status(200).json({
      success: true,
      companies: companiesWithCount,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single public company profile by ID
// @route   GET /api/companies/:id
// @access  Public
export const getCompanyById = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found.',
      });
    }

    // Resolve employer profile for messaging if not set or populated
    let employer = null;
    if (company.employerId) {
      employer = await User.findById(company.employerId).select('_id name email avatar role title');
    }
    if (!employer) {
      employer = await resolveEmployerForCompany(company._id);
    }

    // Fetch active jobs for this company
    const jobs = await Job.find({ companyId: company._id, status: 'Active' }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      company: {
        ...company.toObject(),
        employerId: employer
          ? {
              _id: employer._id,
              name: employer.name,
              email: employer.email,
              avatar: employer.avatar,
              title: employer.title,
            }
          : company.employerId,
        openRoles: jobs.length,
      },
      jobs,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update company profile (for employers)
// @route   PUT /api/companies/:id
// @access  Private (Employer / Admin)
export const updateCompanyProfile = async (req, res, next) => {
  try {
    let company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found.',
      });
    }

    // Verify ownership
    if (
      req.user.role !== 'admin' &&
      company.employerId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this company profile.',
      });
    }

    company = await Company.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Company profile updated successfully.',
      company,
    });
  } catch (err) {
    next(err);
  }
};

