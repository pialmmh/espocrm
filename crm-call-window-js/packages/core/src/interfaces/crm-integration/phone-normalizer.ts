export interface PhoneNormalizer {
  normalize(phone: string): string[];
}

/** Default no-op normalizer — strips non-digits/plus, returns one variant. */
export class IdentityPhoneNormalizer implements PhoneNormalizer {
  normalize(phone: string): string[] {
    const cleaned = (phone || '').replace(/[^\d+]/g, '');
    return cleaned ? [cleaned] : [];
  }
}
