/**
 * Utilitário Centralizado de Validação de Complexidade de Senhas - Brilha+
 * 
 * Regras:
 * 1. Tamanho mínimo: 8 caracteres
 * 2. Pelo menos uma letra maiúscula [A-Z]
 * 3. Pelo menos uma letra minúscula [a-z]
 * 4. Pelo menos um número [0-9]
 * 5. Pelo menos um caractere especial [!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]
 */

export interface PasswordCriteria {
  hasMinLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export interface PasswordValidationResult extends PasswordCriteria {
  isValid: boolean;
  errors: string[];
}

export const SENHA_PADRAO_SISTEMA = 'Brilha@123';

/**
 * Valida a senha contra todos os critérios de complexidade exigidos.
 */
export function validatePassword(password: string): PasswordValidationResult {
  const pwd = password || '';

  const hasMinLength = pwd.length >= 8;
  const hasUpperCase = /[A-Z]/.test(pwd);
  const hasLowerCase = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(pwd);

  const errors: string[] = [];
  if (!hasMinLength) errors.push('A senha deve ter no mínimo 8 caracteres.');
  if (!hasUpperCase) errors.push('A senha deve conter pelo menos uma letra maiúscula.');
  if (!hasLowerCase) errors.push('A senha deve conter pelo menos uma letra minúscula.');
  if (!hasNumber) errors.push('A senha deve conter pelo menos um número.');
  if (!hasSpecialChar) errors.push('A senha deve conter pelo menos um caractere especial.');

  const isValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;

  return {
    isValid,
    hasMinLength,
    hasUpperCase,
    hasLowerCase,
    hasNumber,
    hasSpecialChar,
    errors
  };
}
