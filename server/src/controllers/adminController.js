import User from '../models/User.js';
import Company from '../models/Company.js';
import Job from '../models/Job.js';
import Application from '../models/Application.js';
import Taxonomy from '../models/Taxonomy.js';

// @desc    Get admin platform stats
// @route   GET /api/admin/stats
// @access  Private (Admin)
export const getAdminStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalEmployers = await User.countDocuments({ role: 'employer' });
    const totalCandidates = await User.countDocuments({ role: 'candidate' });
    const totalJobs = await Job.countDocuments();
    const activeJobs = await Job.countDocuments({ status: 'Active' });
    const totalApplications = await Application.countDocuments();
    const totalCompanies = await Company.countDocuments();

    res.status(200).json({
      success: true,
      stats: {
        systemHealth: 'Stable',
        healthDetail: 'All Systems Operational',
        totalUsers,
        totalEmployers,
        totalCandidates,
        totalJobs,
        activeJobs,
        totalApplications,
        totalCompanies,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get users for moderation queue
// @route   GET /api/admin/users
// @access  Private (Admin)
export const getAdminUsers = async (req, res, next) => {
  try {
    const { role, status, search } = req.query;
    const query = {};

    if (role && role !== 'all') {
      query.role = role;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .populate('companyId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user status (Approve / Ban)
// @route   PATCH /api/admin/users/:id/status
// @access  Private (Admin)
export const updateUserStatus = async (req, res, next) => {
  try {
    const { status, flagReason } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    user.status = status;
    if (flagReason !== undefined) {
      user.flagReason = flagReason;
    }
    await user.save();

    res.status(200).json({
      success: true,
      message: `User status changed to ${status}.`,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get companies for moderation queue
// @route   GET /api/admin/companies
// @access  Private (Admin)
export const getAdminCompanies = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.name = new RegExp(search, 'i');
    }

    const companies = await Company.find(query)
      .populate('employerId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: companies.length,
      companies,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update company status (Approve / Ban)
// @route   PATCH /api/admin/companies/:id/status
// @access  Private (Admin)
export const updateCompanyStatus = async (req, res, next) => {
  try {
    const { status, flagReason } = req.body;
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found.',
      });
    }

    company.status = status;
    if (flagReason !== undefined) {
      company.flagReason = flagReason;
    }
    await company.save();

    res.status(200).json({
      success: true,
      message: `Company status changed to ${status}.`,
      company,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get taxonomy (categories and tags)
// @route   GET /api/admin/taxonomy
// @access  Public (or Private)
export const getTaxonomy = async (req, res, next) => {
  try {
    const categories = await Taxonomy.find({ type: 'category' }).sort({ name: 1 });
    const tags = await Taxonomy.find({ type: 'tag' }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      categories,
      tags,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add new taxonomy tag or category
// @route   POST /api/admin/taxonomy
// @access  Private (Admin)
export const addTaxonomy = async (req, res, next) => {
  try {
    const { name, type = 'tag' } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Name is required.',
      });
    }

    const existing = await Taxonomy.findOne({
      name: new RegExp(`^${name.trim()}$`, 'i'),
      type,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `This ${type} already exists.`,
      });
    }

    const item = await Taxonomy.create({
      name: name.trim(),
      type,
    });

    res.status(201).json({
      success: true,
      message: `${type === 'category' ? 'Category' : 'Tag'} added successfully.`,
      item,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete taxonomy tag or category
// @route   DELETE /api/admin/taxonomy/:id
// @access  Private (Admin)
export const deleteTaxonomy = async (req, res, next) => {
  try {
    const item = await Taxonomy.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Taxonomy item not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: `${item.type} deleted successfully.`,
    });
  } catch (err) {
    next(err);
  }
};

