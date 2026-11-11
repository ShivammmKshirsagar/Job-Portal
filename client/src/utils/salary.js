/**
 * CareerConnect Centralised Salary Formatting Utility
 * Localised for the Indian Job Market (INR & LPA)
 */

/**
 * Converts a numeric INR salary amount into an LPA string representation.
 * Examples:
 *   400000  → '₹4 LPA'
 *   650000  → '₹6.5 LPA'
 *   800000  → '₹8 LPA'
 *   1200000 → '₹12 LPA'
 *   2500000 → '₹25 LPA'
 *
 * @param {number|string} amount - Numeric amount in INR per annum.
 * @returns {string} Formatted LPA string or empty string if invalid.
 */
export const formatLpa = (amount) => {
  const num = Number(amount);
  if (!num || isNaN(num) || num <= 0) return '';
  const lakhs = num / 100000;
  const formatted = lakhs % 1 === 0 ? lakhs.toString() : Number(lakhs.toFixed(2)).toString();
  return `₹${formatted} LPA`;
};

/**
 * Formats a salary range from numeric min and max INR amounts into an LPA range string.
 * Examples:
 *   (400000, 700000)   → '₹4–7 LPA'
 *   (650000, 1200000)  → '₹6.5–12 LPA'
 *   (800000, 1500000)  → '₹8–15 LPA'
 *   (1200000, 2400000) → '₹12–24 LPA'
 *   (1800000, 3000000) → '₹18–30 LPA'
 *
 * @param {number|string} min - Minimum annual salary in INR.
 * @param {number|string} max - Maximum annual salary in INR.
 * @param {string} [fallback='Competitive Salary'] - String to return if neither is valid.
 * @returns {string} Formatted salary range in LPA.
 */
export const formatSalaryRange = (min, max, fallback = 'Competitive Salary') => {
  const minNum = Number(min);
  const maxNum = Number(max);

  const hasMin = Boolean(minNum && !isNaN(minNum) && minNum > 0);
  const hasMax = Boolean(maxNum && !isNaN(maxNum) && maxNum > 0);

  if (hasMin && hasMax) {
    const minL = minNum / 100000;
    const maxL = maxNum / 100000;
    const minStr = minL % 1 === 0 ? minL.toString() : Number(minL.toFixed(2)).toString();
    const maxStr = maxL % 1 === 0 ? maxL.toString() : Number(maxL.toFixed(2)).toString();

    if (minStr === maxStr) {
      return `₹${minStr} LPA`;
    }
    return `₹${minStr}–${maxStr} LPA`;
  }

  if (hasMin) {
    return `From ${formatLpa(minNum)}`;
  }

  if (hasMax) {
    return `Up to ${formatLpa(maxNum)}`;
  }

  return fallback;
};

/**
 * Formats the salary display for a job entity.
 * Checks job.salaryMin / job.salaryMax first, then custom job.salary string.
 *
 * @param {object} job - Job object containing salary fields.
 * @param {string} [fallback='Competitive Salary'] - Fallback text.
 * @returns {string}
 */
export const formatJobSalary = (job, fallback = 'Competitive Salary') => {
  if (!job) return fallback;

  if (job.salaryMin || job.salaryMax) {
    return formatSalaryRange(job.salaryMin, job.salaryMax, fallback);
  }

  if (job.salary && typeof job.salary === 'string' && job.salary.trim() !== '') {
    // If the legacy string contains '$', strip or ignore it
    if (!job.salary.includes('$')) {
      return job.salary;
    }
  }

  return fallback;
};

/**
 * Formats a numeric amount using the standard Indian numbering system (e.g. ₹8,00,000).
 *
 * @param {number|string} amount
 * @returns {string}
 */
export const formatInrFull = (amount) => {
  const num = Number(amount);
  if (!num || isNaN(num)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};

export default {
  formatLpa,
  formatSalaryRange,
  formatJobSalary,
  formatInrFull,
};

