import mongoose from 'mongoose';

const fileStorageSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    originalName: {
      type: String,
      default: 'document.pdf',
      trim: true,
    },
    contentType: {
      type: String,
      default: 'application/pdf',
      trim: true,
    },
    data: {
      type: Buffer,
      required: true,
    },
    size: {
      type: Number,
      default: 0,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const FileStorage = mongoose.model('FileStorage', fileStorageSchema);
export default FileStorage;

