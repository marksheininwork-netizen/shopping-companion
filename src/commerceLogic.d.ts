export type GiftIdea = { suggestedPrice: number; interests: string[]; };
export function filterGiftIdeas<T extends GiftIdea>(products: T[], interests: string[], budget: number | string): T[];
export function validatePriceObservation(input: { name: string; url: string; price: number | string; observedAt: string }): { id: string; name: string; url: string; price: number; observedAt: string; source: "manual" };
