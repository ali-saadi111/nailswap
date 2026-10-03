/** Legal copy (English). The surrounding page chrome is translated; the documents themselves are
 *  the binding English versions. */
export interface LegalSection {
  id: string;
  title: string;
  body: string[];
}
export interface LegalDoc {
  slug: "terms" | "privacy";
  updated: string; // ISO date
  minutes: number;
  sections: LegalSection[];
}

export const LEGAL: Record<"terms" | "privacy", LegalDoc> = {
  terms: {
    slug: "terms",
    updated: "2026-10-01",
    minutes: 6,
    sections: [
      {
        id: "who",
        title: "Who we are",
        body: [
          "NailSwap is run by NailSwap SAL, Beirut. We help you try nail designs on your own hand and book the salon that does them. Salons set their own prices and do the work; NailSwap is the platform in between.",
        ],
      },
      {
        id: "bookings",
        title: "Bookings and cancellations",
        body: [
          "A booking is confirmed when you receive a message with your booking reference. Some salons confirm requests by hand; until they do, your booking shows as pending.",
          "You can reschedule or cancel from the link in your confirmation message until the salon's cut-off time (shown on the booking page, usually 24 hours before). Later cancellations and no-shows may be charged by the salon according to its own policy.",
        ],
      },
      {
        id: "tryon",
        title: "Try-on photos and AI processing",
        body: [
          "Live camera try-on runs entirely in your browser; no video leaves your device. When you use the AI photo try-on, the photo you upload is processed to render the design on your nails and is deleted after 30 days unless you save the look. Saved looks stay until you remove them.",
          "Photos are screened automatically; images that are not of a hand or that break our rules are rejected and deleted.",
        ],
      },
      {
        id: "payments",
        title: "Payments",
        body: [
          "You pay the salon directly unless a deposit is shown before you confirm. Deposits are handled by the salon's payment provider; NailSwap does not store card numbers.",
        ],
      },
      {
        id: "reviews",
        title: "Reviews and your content",
        body: [
          "You can review a salon after a completed visit. Reviews must be honest and about your own experience. We may remove reviews that are abusive, off-topic or appear fraudulent, and salons may reply publicly.",
          "By posting a review or photo you give NailSwap and the salon a licence to show it on the salon page and in NailSwap's directory.",
        ],
      },
      {
        id: "accounts",
        title: "Accounts",
        body: [
          "You sign in with a one-time code sent to your mobile number. Keep your number up to date so you receive confirmations and reminders. You can delete your account and saved data from your profile at any time.",
        ],
      },
      {
        id: "liability",
        title: "Liability and changes",
        body: [
          "NailSwap provides the try-on as a preview. Results vary with lighting, nail condition and the salon's technique; the rendered look is not a guarantee of the final result.",
          "We may update these terms; material changes are announced in the app at least 14 days in advance. Lebanese law applies.",
        ],
      },
    ],
  },
  privacy: {
    slug: "privacy",
    updated: "2026-10-01",
    minutes: 5,
    sections: [
      {
        id: "data",
        title: "What we collect",
        body: [
          "Your mobile number and name when you sign in or book; booking details (salon, service, time, notes); try-on photos you upload for AI rendering; looks you save; and basic usage events (pages viewed, try-ons started, bookings made) used to run and improve the service.",
        ],
      },
      {
        id: "why",
        title: "Why we use it",
        body: [
          "To create and manage your bookings, send confirmations and reminders by WhatsApp, SMS or email, render your try-on, keep your saved looks, show salons which designs convert, and prevent abuse.",
        ],
      },
      {
        id: "photos",
        title: "Photos",
        body: [
          "Hand photos are stored privately, stripped of location metadata, and deleted after 30 days unless you save the look. They are never used to train AI models. Live camera frames are processed on your device only.",
        ],
      },
      {
        id: "sharing",
        title: "Who sees your data",
        body: [
          "The salon you book with sees your name, number, notes and the look you chose. Our processors (hosting, messaging, AI rendering, payments) see only what they need to deliver their part of the service. We do not sell personal data.",
        ],
      },
      {
        id: "retention",
        title: "Retention and your rights",
        body: [
          "Bookings are kept for the salon's records; photos follow the 30-day rule above; usage events are aggregated after 24 months. You can access, correct or delete your data from your profile or by writing to privacy@nailswap.app.",
        ],
      },
      {
        id: "cookies",
        title: "Cookies",
        body: [
          "We use strictly necessary cookies for sign-in, language and an anonymous try-on id. There is no third-party advertising tracking.",
        ],
      },
    ],
  },
};
