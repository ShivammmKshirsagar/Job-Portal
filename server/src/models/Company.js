import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide the company name'],
      trim: true,
    },
    logoUrl: {
      type: String,
      default: '',
    },
    bannerUrl: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    website: {
      type: String,
      default: '',
      trim: true,
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    industry: {
      type: String,
      default: 'Technology',
      trim: true,
    },
    size: {
      type: String,
      default: '50-200 Employees',
    },
    foundedYear: {
      type: Number,
      default: 2018,
    },
    stage: {
      type: String,
      default: 'Growth',
    },
    culture: {
      type: String,
      default: '',
    },
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'banned'],
      default: 'active',
    },
    flagReason: {
      type: String,
      default: '',
    },
    reportedBy: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

companySchema.index({ name: 'text', description: 'text', industry: 'text' });

const Company = mongoose.model('Company', companySchema);
export default Company;

