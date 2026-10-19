/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { schoolContactSchema, substituteContactSchema, teacherRegistrationSchema } from "./contact-schemas";

const address = { street_address: "Skolgatan 10", postal_code: "123 45", city: "Stockholm" };
const contact = { full_name: "Test Person", email: "person@example.com", phone: "0701234567" };
describe("Obligatoriska kontaktuppgifter", () => {
  test("skolor kräver fullständig adress och kontaktperson", () => {
    const school = { name: "Testskolan", contact_person: "Test Person", email: contact.email, phone: contact.phone, ...address };
    expect(schoolContactSchema.safeParse(school).success).toBe(true);
    for (const field of Object.keys(school)) expect(schoolContactSchema.safeParse({ ...school, [field]: "" }).success).toBe(false);
  });
  test("vikarier kräver adress, telefon och minst ett ämne", () => {
    const profile = { ...contact, ...address, subjects: ["Svenska"], school_name: "", graduation_year: null, availability: "" };
    expect(substituteContactSchema.safeParse(profile).success).toBe(true);
    for (const field of [...Object.keys(contact), ...Object.keys(address)]) expect(substituteContactSchema.safeParse({ ...profile, [field]: "" }).success).toBe(false);
    expect(substituteContactSchema.safeParse({ ...profile, subjects: [] }).success).toBe(false);
  });
  test("lärare kräver giltig e-post och telefon utan hemadress", () => {
    const teacher = { fullName: contact.full_name, email: contact.email, phone: contact.phone, password: "testpassword123", schoolId: "11111111-1111-4111-8111-111111111111", code: "ABCDE12345" };
    expect(teacherRegistrationSchema.safeParse(teacher).success).toBe(true);
    expect(teacherRegistrationSchema.safeParse({ ...teacher, email: "fel" }).success).toBe(false);
    expect(teacherRegistrationSchema.safeParse({ ...teacher, phone: "" }).success).toBe(false);
    expect(teacherRegistrationSchema.safeParse({ ...teacher, phone: "abcde" }).success).toBe(false);
  });
});