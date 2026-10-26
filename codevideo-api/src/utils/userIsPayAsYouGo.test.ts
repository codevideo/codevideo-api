import { ICodeVideoUserMetadata } from "@fullstackcraftllc/codevideo-types";
import { userIsPayAsYouGo } from "./userIsPayAsYouGo.js";

// Shapes written by studio.codevideo.io's Clerk sign-up webhook and Stripe
// billing functions; real metadata often lacks the fields that were never set.
const meta = (fields: Partial<ICodeVideoUserMetadata>) => fields as ICodeVideoUserMetadata;

describe("userIsPayAsYouGo", () => {
  it("treats new sign-ups and token top-ups as pay-as-you-go", () => {
    expect(userIsPayAsYouGo(meta({ tokens: 50 }))).toBe(true);
    expect(userIsPayAsYouGo(meta({ tokens: 60, stripeId: "cus_123" }))).toBe(true);
  });

  it("treats a cancelled subscription as pay-as-you-go", () => {
    expect(userIsPayAsYouGo(meta({ tokens: 10, subscriptionPlan: "", subscriptionStatus: "canceled" }))).toBe(true);
  });

  it("treats a subscription that is not active, e.g. past due, as pay-as-you-go", () => {
    expect(userIsPayAsYouGo(meta({ subscriptionPlan: "creator", subscriptionStatus: "past_due" }))).toBe(true);
  });

  it("does not treat active monthly subscribers as pay-as-you-go", () => {
    for (const plan of ["starter", "creator", "enterprise"]) {
      expect(userIsPayAsYouGo(meta({ subscriptionPlan: plan, subscriptionStatus: "active" }))).toBe(false);
    }
  });

  it("does not treat lifetime members as pay-as-you-go", () => {
    expect(
      userIsPayAsYouGo(meta({ subscriptionPlan: "lifetime", subscriptionStatus: "active", unlimited: true }))
    ).toBe(false);
    // unlimited alone is enough, whatever the status says
    expect(userIsPayAsYouGo(meta({ subscriptionPlan: "lifetime", unlimited: true }))).toBe(false);
  });
});
