import { z } from 'zod';

// Common validation schemas
export const emailSchema = z.string().email('Please enter a valid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number');

export const phoneSchema = z
  .string()
  .regex(/^(\+27|0)[0-9]{9}$/, 'Please enter a valid South African phone number');

export const idNumberSchema = z
  .string()
  .regex(/^[0-9]{13}$/, 'Please enter a valid 13-digit ID number');

// Form validation schemas
export const userProfileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: emailSchema,
  phone: phoneSchema.optional(),
});

export const tutorApplicationSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: emailSchema,
  idNumber: idNumberSchema,
  qualificationType: z.string().min(1, 'Qualification type is required'),
  institution: z.string().min(1, 'Institution is required'),
  yearObtained: z.number().min(1950).max(new Date().getFullYear()),
});

// Helper functions
export const validateForm = <T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: string[] } => {
  try {
    const validData = schema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.errors.map(err => err.message) 
      };
    }
    return { success: false, errors: ['Validation failed'] };
  }
};