export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Use at least 8 characters, including at least one letter and one number.';

export function validatePasswordRules(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Use at least one letter and one number.';
  }

  return null;
}
