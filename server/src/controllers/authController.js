import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Company from '../models/Company.js';
import { getJwtSecret, getJwtExpire } from '../config/jwt.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/sendEmail.js';

// Helper to sign JWT token
const signToken = (id) => {
  return jwt.sign(
    { id },
    getJwtSecret(),
    {
      expiresIn: getJwtExpire(),
    }
  );
};

// Send response with token + optional cookie
const sendTokenResponse = (user, statusCode, res, message = 'Success', extra = {}) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  res.cookie('token', token, cookieOptions);

  const responseBody = {
    success: true,
    message,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: Boolean(user.isVerified),
      avatar: user.avatar,
      title: user.title,
      companyId: user.companyId,
      resumeUrl: user.resumeUrl,
      skills: user.skills,
      location: user.location,
      status: user.status,
    },
    ...extra,
  };

  res.status(statusCode).json(responseBody);
};

// @desc    Register a new user (Candidate or Employer)
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, companyName, companyWebsite, industry } = req.body;

    // Disallow registering directly as admin
    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Administrator accounts cannot be self-registered.',
      });
    }

    const assignedRole = role === 'employer' ? 'employer' : 'candidate';

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Generate secure 32-byte (256-bit) email verification token
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const hashedVerificationToken = crypto
      .createHash('sha256')
      .update(rawVerificationToken)
      .digest('hex');

    // Create user with isVerified: false by default
    const user = await User.create({
      name,
      email,
      password,
      role: assignedRole,
      isVerified: false,
      verificationToken: hashedVerificationToken,
      verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      lastVerificationEmailSent: new Date(),
    });

    // If role is employer and company name was provided, create the company profile
    if (assignedRole === 'employer') {
      const company = await Company.create({
        name: companyName || `${name}'s Company`,
        website: companyWebsite || '',
        industry: industry || 'Technology',
        employerId: user._id,
      });

      user.companyId = company._id;
      await user.save();
    }

    // Dispatch verification email
    await sendVerificationEmail({
      email: user.email,
      name: user.name,
      token: rawVerificationToken,
      origin: req.headers.origin,
    });

    const populatedUser = await User.findById(user._id).populate('companyId');

    const extra = {};
    if (process.env.NODE_ENV !== 'production') {
      extra.devVerificationToken = rawVerificationToken;
    }

    sendTokenResponse(
      populatedUser,
      201,
      res,
      'Account registered successfully. A verification link has been sent to your email.',
      extra
    );
  } catch (err) {
    next(err);
  }
};

// @desc    Verify email address
// @route   GET /api/auth/verify-email/:token or POST /api/auth/verify-email
// @access  Public
export const verifyEmail = async (req, res, next) => {
  try {
    const rawToken = req.params.token || req.body.token;

    if (!rawToken || typeof rawToken !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required.',
      });
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken.trim())
      .digest('hex');

    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired email verification token.',
      });
    }

    // Mark as verified and invalidate token
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully. You may now access all platform features.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: true,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Resend email verification token (with rate limiting)
// @route   POST /api/auth/resend-verification
// @access  Public
export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user account found with that email address.',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'This account email is already verified.',
      });
    }

    // Rate limiting: enforce at least 60 seconds between resend requests
    const COOLDOWN_MS = 60 * 1000;
    if (user.lastVerificationEmailSent && Date.now() - new Date(user.lastVerificationEmailSent).getTime() < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - (Date.now() - new Date(user.lastVerificationEmailSent).getTime())) / 1000);
      return res.status(429).json({
        success: false,
        message: `Too many verification requests. Please wait ${waitSec} seconds before requesting another email.`,
      });
    }

    // Generate new 32-byte verification token
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = crypto
      .createHash('sha256')
      .update(rawVerificationToken)
      .digest('hex');
    user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
    user.lastVerificationEmailSent = new Date();
    await user.save();

    await sendVerificationEmail({
      email: user.email,
      name: user.name,
      token: rawVerificationToken,
      origin: req.headers.origin,
    });

    const response = {
      success: true,
      message: 'A new verification email has been dispatched.',
    };

    if (process.env.NODE_ENV !== 'production') {
      response.devVerificationToken = rawVerificationToken;
    }

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

// @desc    User Login
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email }).select('+password').populate('companyId');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your email and password.',
      });
    }

    // Check if account is suspended / banned
    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact platform administration.',
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your email and password.',
      });
    }

    sendTokenResponse(user, 200, res, 'Logged in successfully.');
  } catch (err) {
    next(err);
  }
};

// @desc    Get Current User Profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('companyId');
    res.status(200).json({
      success: true,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email ? email.toLowerCase().trim() : '' });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with that email address.',
      });
    }

    // Generate cryptographically secure 32-byte (256-bit) reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Store only hashed token in MongoDB
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // 10-minute expiration
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Dispatch password reset email
    await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      token: resetToken,
      origin: req.headers.origin,
    });

    const isProd = process.env.NODE_ENV === 'production';

    // In non-production environments, safely log for dev debugging
    if (!isProd) {
      console.log(`[Auth Dev Mode] Password reset token for ${user.email}: ${resetToken}`);
    }

    const response = {
      success: true,
      message: 'If an account with that email exists, password reset instructions have been sent.',
    };

    // Explicitly restrict devResetToken to development / testing environments only
    if (!isProd) {
      response.devResetToken = resetToken;
    }

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and new password are required.',
      });
    }

    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(token.trim())
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token.',
      });
    }

    // Set new password (pre-save hook will hash it with bcrypt)
    user.password = password;

    // Enforce single-use by immediately invalidating the token
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    sendTokenResponse(user, 200, res, 'Password reset successful. You are now logged in.');
  } catch (err) {
    next(err);
  }
};

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Public
export const logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: 'User logged out successfully.',
  });
};
