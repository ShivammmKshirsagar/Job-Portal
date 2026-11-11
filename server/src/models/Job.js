import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a job title'],
      trim: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide a detailed job description'],
    },
    responsibilities: {
      type: [String],
      default: [],
    },
    requirements: {
      type: [String],
      default: [],
    },
    jobType: {
      type: String,
      enum: ['Full-Time', 'Part-Time', 'Contract', 'Remote', 'Internship'],
      default: 'Full-Time',
    },
    experienceLevel: {
      type: String,
      enum: ['Entry Level', 'Mid Level', 'Senior Level', 'Lead / Executive'],
      default: 'Mid Level',
    },
    workplaceType: {
      type: String,
      enum: ['On-site', 'Hybrid', 'Remote'],
      default: 'Hybrid',
    },
    category: {
      type: String,
      default: 'Development',
      trim: true,
    },
    salaryMin: {
      type: Number,
      default: 0,
    },
    salaryMax: {
      type: Number,
      default: 0,
    },
    salaryCurrency: {
      type: String,
      default: 'INR',
    },
    salaryPeriod: {
      type: String,
      default: 'yearly',
    },
    location: {
      type: String,
      required: [true, 'Please specify job location'],
      trim: true,
    },
    skillsRequired: {
      type: [String],
      default: [],
    },
    featured: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['Active', 'Closed'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
  }
);

jobSchema.index({ title: 'text', description: 'text', location: 'text', category: 'text' });
jobSchema.index({ status: 1, createdAt: -1 });

const Job = mongoose.model('Job', jobSchema);
export default Job;

