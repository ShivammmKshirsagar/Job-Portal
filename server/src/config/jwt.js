/**
 * CareerConnect — Centralized JWT Configuration & Validation
 * Enforces cryptographic security standards for JWT token operations.
 * 
 * Requirements:
 * 1. process.env.JWT_SECRET must be defined and non-empty.
 * 2. Secret must be at least 32 characters long to ensure cryptographic resilience.
 * 3. Never falls back to a hardcoded string.
 * 4. Fails fast at server startup if validation fails.
 */

export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Validates and retrieves the configured JWT secret.
 * Throws a descriptive configuration error if missing, empty, or too short.
 * @returns {string} The validated JWT secret.
 */
export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    throw new Error(
      '[Security Configuration Error] JWT_SECRET environment variable is missing or empty. ' +
      'A secure secret must be configured in your environment (.env file).'
    );
  }

  const trimmedSecret = secret.trim();

  if (trimmedSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `[Security Configuration Error] JWT_SECRET is too short (${trimmedSecret.length} characters). ` +
      `For cryptographic security, it must be at least ${MIN_JWT_SECRET_LENGTH} characters long.`
    );
  }

  return trimmedSecret;
};

/**
 * Validates the JWT configuration at startup.
 * Fails fast by throwing an Error if JWT_SECRET is invalid.
 * @returns {boolean} True if configuration is valid.
 */
export const validateJwtConfig = () => {
  getJwtSecret();
  return true;
};

/**
 * Retrieves the configured JWT expiration time.
 * @returns {string} Expiration string (e.g. '7d').
 */
export const getJwtExpire = () => {
  return process.env.JWT_EXPIRE || '7d';
};

export default {
  getJwtSecret,
  validateJwtConfig,
  getJwtExpire,
  MIN_JWT_SECRET_LENGTH,
};

