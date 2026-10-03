import "server-only";
import { mpgsProvider } from "./mpgs";
import type { CardPaymentProvider, ManualMethod } from "./types";

export type {
  CardPaymentProvider,
  CheckoutSession,
  CreateCheckoutInput,
  ManualMethod,
  PaymentPurpose,
} from "./types";

/** The configured card provider, or null when only manual payments are accepted. */
export function getCardProvider(): CardPaymentProvider | null {
  return mpgsProvider.isConfigured() ? mpgsProvider : null;
}

export const MANUAL_METHODS: ManualMethod[] = ["cash", "whish", "omt", "bank_transfer"];

/** Top-up packs: credits and USD price. */
export const TOPUP_PACKS = [
  { id: "pack_50", credits: 50, priceUsd: 9 },
  { id: "pack_200", credits: 200, priceUsd: 29 },
  { id: "pack_500", credits: 500, priceUsd: 59 },
] as const;

export type TopupPackId = (typeof TOPUP_PACKS)[number]["id"];

/** Instructions shown to salons for manual payments (per method). */
export const MANUAL_PAYMENT_INSTRUCTIONS: Record<ManualMethod, { en: string; ar: string; fr: string }> = {
  cash: {
    en: "Pay in cash to your NailSwap account manager and enter the receipt number below.",
    ar: "ادفع نقدًا لمدير حسابك في NailSwap وأدخل رقم الإيصال أدناه.",
    fr: "Payez en espèces à votre chargé de compte NailSwap et saisissez le numéro de reçu ci-dessous.",
  },
  whish: {
    en: "Send the amount via Whish Money to the NailSwap business account (details in your invoice) and enter the transaction ID.",
    ar: "أرسل المبلغ عبر Whish Money إلى حساب NailSwap التجاري (التفاصيل في الفاتورة) وأدخل رقم العملية.",
    fr: "Envoyez le montant via Whish Money au compte NailSwap (détails sur la facture) et saisissez l'identifiant de transaction.",
  },
  omt: {
    en: "Transfer via OMT to the beneficiary shown on your invoice and enter the OMT reference.",
    ar: "حوّل عبر OMT إلى المستفيد المذكور في الفاتورة وأدخل مرجع OMT.",
    fr: "Transférez via OMT au bénéficiaire indiqué sur la facture et saisissez la référence OMT.",
  },
  bank_transfer: {
    en: "Wire the amount to the bank account on your invoice and enter the transfer reference.",
    ar: "حوّل المبلغ إلى الحساب البنكي المذكور في الفاتورة وأدخل مرجع التحويل.",
    fr: "Virez le montant sur le compte indiqué sur la facture et saisissez la référence du virement.",
  },
};
