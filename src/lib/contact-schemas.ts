import { z } from "zod";
import { SUBJECTS } from "./subjects";

export const nameField = z.string().trim().min(1, "Fyll i namn").max(120);
export const emailField = z.string().trim().email("Fyll i en giltig e-postadress").max(255);
export const phoneField = z.string().trim().min(5, "Fyll i telefonnummer").max(40)
  .regex(/^[+0-9 ()-]+$/, "Fyll i ett giltigt telefonnummer")
  .refine((v) => v.replace(/\D/g, "").length >= 5, "Fyll i ett giltigt telefonnummer");
export const addressShape = {
  street_address: z.string().trim().min(1, "Fyll i gatuadress").max(200),
  postal_code: z.string().trim().regex(/^\d{3} ?\d{2}$/, "Postnummer ska innehålla fem siffror"),
  city: z.string().trim().min(1, "Fyll i ort").max(120),
};
export const contactShape = { full_name: nameField, email: emailField, phone: phoneField };
export const schoolContactSchema = z.object({
  name: nameField, contact_person: nameField, email: emailField, phone: phoneField, ...addressShape,
});
export const substituteContactSchema = z.object({
  ...contactShape, ...addressShape,
  subjects: z.array(z.string().refine((s) => SUBJECTS.includes(s), "Välj ett giltigt ämne")).min(1, "Välj minst ett ämne"),
  school_name: z.string().trim().max(120),
  graduation_year: z.number().int().min(1970).max(2100).nullable(),
  availability: z.string().trim().max(1000),
});
export const teacherRegistrationSchema = z.object({
  fullName: nameField, email: emailField.transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(72), phone: phoneField,
  schoolId: z.string().uuid(), code: z.string().trim().min(1).max(40),
});