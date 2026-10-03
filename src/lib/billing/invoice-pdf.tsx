import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { format } from "date-fns";
import type { Invoice, Salon } from "@/lib/supabase/types";

/**
 * Invoice PDF (English; the built-in Helvetica has no Arabic glyphs — register a font in
 * `Font.register` before localising).
 */
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#1a1714" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  brand: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#8B5E3C" },
  muted: { color: "#6b645d" },
  h2: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#e8e2da" },
  cell: { flex: 1 },
  cellRight: { width: 90, textAlign: "right" },
  total: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  totalLabel: { width: 120, textAlign: "right", fontFamily: "Helvetica-Bold" },
  totalValue: { width: 90, textAlign: "right", fontFamily: "Helvetica-Bold" },
  badge: {
    fontSize: 10,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: "#f1ebe4",
  },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 9, color: "#9a928a" },
});

interface LineItem {
  description?: string;
  amount?: number;
  plan_code?: string;
  credits?: number;
}

export function InvoiceDocument({
  invoice,
  salon,
}: {
  invoice: Invoice;
  salon: Pick<Salon, "name" | "address" | "city" | "email" | "phone">;
}) {
  const items = (invoice.line_items as LineItem[]) ?? [];
  const money = (n: number | string) => `${invoice.currency} ${Number(n).toFixed(2)}`;
  const date = (d: string | null) => (d ? format(new Date(d), "d MMM yyyy") : "—");
  return (
    <Document title={`Invoice ${invoice.number}`} author="NailSwap">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>NailSwap</Text>
            <Text style={styles.muted}>nailswap.app · billing@nailswap.app</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.h2}>Invoice {invoice.number}</Text>
            <Text style={styles.muted}>Issued {date(invoice.created_at)}</Text>
            <Text style={styles.muted}>Due {date(invoice.due_at)}</Text>
            <Text style={[styles.badge, { marginTop: 6 }]}>{invoice.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={styles.h2}>Billed to</Text>
          <Text>{salon.name}</Text>
          {salon.address ? <Text style={styles.muted}>{salon.address}</Text> : null}
          {salon.city ? <Text style={styles.muted}>{salon.city}, Lebanon</Text> : null}
          {salon.email ? <Text style={styles.muted}>{salon.email}</Text> : null}
        </View>

        {invoice.period_start && invoice.period_end ? (
          <Text style={[styles.muted, { marginBottom: 12 }]}>
            Service period: {date(invoice.period_start)} – {date(invoice.period_end)}
          </Text>
        ) : null}

        <View style={[styles.row, { borderBottomColor: "#1a1714" }]}>
          <Text style={[styles.cell, { fontFamily: "Helvetica-Bold" }]}>Description</Text>
          <Text style={[styles.cellRight, { fontFamily: "Helvetica-Bold" }]}>Amount</Text>
        </View>
        {items.map((item, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.cell}>
              {item.description ??
                (item.plan_code ? `${item.plan_code} plan` : `${item.credits ?? ""} credits`)}
            </Text>
            <Text style={styles.cellRight}>{money(item.amount ?? 0)}</Text>
          </View>
        ))}

        <View style={styles.total}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{money(invoice.subtotal)}</Text>
        </View>
        <View style={styles.total}>
          <Text style={styles.totalLabel}>Tax</Text>
          <Text style={styles.totalValue}>{money(invoice.tax)}</Text>
        </View>
        <View style={styles.total}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{money(invoice.total)}</Text>
        </View>
        {invoice.paid_at ? (
          <Text style={[styles.muted, { marginTop: 10, textAlign: "right" }]}>
            Paid on {date(invoice.paid_at)}
          </Text>
        ) : null}

        <View style={{ marginTop: 32 }}>
          <Text style={styles.h2}>How to pay</Text>
          <Text>Card: open Dashboard → Billing and pay online.</Text>
          <Text>
            Whish / OMT / bank transfer: send the total to the NailSwap business account and enter the
            transaction reference in Dashboard → Billing.
          </Text>
          {invoice.notes ? <Text style={{ marginTop: 6 }}>{invoice.notes}</Text> : null}
        </View>

        <Text style={styles.footer}>
          NailSwap · AI nail try-on & booking for salons in Lebanon · This invoice was generated
          automatically.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(
  invoice: Invoice,
  salon: Pick<Salon, "name" | "address" | "city" | "email" | "phone">,
): Promise<Buffer> {
  const buf = await renderToBuffer(<InvoiceDocument invoice={invoice} salon={salon} />);
  return Buffer.from(buf);
}
