import mongoose from 'mongoose';

const taxonomySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide name'],
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['category', 'tag'],
      default: 'tag',
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Taxonomy = mongoose.model('Taxonomy', taxonomySchema);
export default Taxonomy;

