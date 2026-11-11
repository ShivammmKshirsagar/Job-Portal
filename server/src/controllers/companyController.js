import Company from '../models/Company.js';
import Job from '../models/Job.js';

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

    // Fetch active jobs for this company
    const jobs = await Job.find({ companyId: company._id, status: 'Active' }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      company: {
        ...company.toObject(),
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

