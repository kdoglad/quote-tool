import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { PDFQuoteData } from '../types/domain.types'

// ============================================================
// Styles
// ============================================================

const BRAND_GREEN = '#16a34a'
const DARK = '#0f172a'
const MEDIUM = '#475569'
const LIGHT = '#94a3b8'
const BORDER = '#e2e8f0'
const PAGE_PADDING = 40

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    color: DARK,
    fontSize: 9,
    paddingTop: PAGE_PADDING,
    paddingBottom: PAGE_PADDING + 20,
    paddingHorizontal: PAGE_PADDING,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: BRAND_GREEN,
  },
  companyName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: BRAND_GREEN },
  companyTagline: { fontSize: 8, color: MEDIUM, marginTop: 2 },
  quoteNumber: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: DARK, textAlign: 'right' },
  quoteDate: { fontSize: 8, color: MEDIUM, textAlign: 'right', marginTop: 2 },
  // Section heading
  sectionHeading: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_GREEN,
    marginBottom: 6,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Customer block
  customerBlock: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  customerCol: { flex: 1 },
  label: { fontSize: 7, color: LIGHT, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  value: { fontSize: 9, color: DARK },
  // Table
  table: { width: '100%', marginBottom: 8 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 6,
    minHeight: 18,
  },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  colDesc: { flex: 1, paddingRight: 6 },
  colCode: { width: 52, paddingRight: 4 },
  colQty: { width: 32, textAlign: 'right', paddingRight: 4 },
  colUnit: { width: 28, textAlign: 'center', paddingRight: 4 },
  colTotal: { width: 70, textAlign: 'right' },
  headerText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MEDIUM },
  cellText: { fontSize: 8.5, color: DARK },
  cellTextMuted: { fontSize: 7.5, color: MEDIUM, marginTop: 1 },
  // Totals
  totalsBlock: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
    alignItems: 'flex-end',
  },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 3 },
  totalLabel: { width: 160, textAlign: 'right', paddingRight: 12, color: MEDIUM, fontSize: 8.5 },
  totalValue: { width: 80, textAlign: 'right', fontFamily: 'Helvetica', fontSize: 8.5, color: DARK },
  grandTotalLabel: { width: 160, textAlign: 'right', paddingRight: 12, fontFamily: 'Helvetica-Bold', fontSize: 10, color: DARK },
  grandTotalValue: { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 10, color: BRAND_GREEN },
  // Exclusions
  exclusionItem: { fontSize: 8.5, color: MEDIUM, marginBottom: 3, paddingLeft: 10 },
  // Disclaimer
  disclaimer: { fontSize: 7.5, color: LIGHT, lineHeight: 1.4, marginTop: 8 },
  // Footer
  footer: {
    position: 'absolute',
    bottom: PAGE_PADDING,
    left: PAGE_PADDING,
    right: PAGE_PADDING,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: LIGHT },
  pageNum: { fontSize: 7, color: LIGHT },
  // Rebate
  rebateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rebateLabel: { flex: 1, fontSize: 8.5, color: DARK },
  rebateValue: { width: 80, textAlign: 'right', fontSize: 8.5, color: '#16a34a', fontFamily: 'Helvetica-Bold' },
})

// ============================================================
// Helper: currency formatter
// ============================================================

function fmtAUD(value: number): string {
  const abs = Math.abs(value)
  const formatted = abs.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${value < 0 ? '-' : ''}$${formatted}`
}

// ============================================================
// PDF Document Component
// ============================================================

function QuotePDFDocument({ data }: { data: PDFQuoteData }) {
  const DISCLAIMER = [
    `This quotation is valid for 30 days from the date of issue unless otherwise stated. Prices exclude GST unless marked otherwise.`,
    `This quotation is based on information provided by the client and is subject to site inspection and network authority approval.`,
    `Smart Commercial Solar reserves the right to adjust pricing if site conditions differ materially from those described.`,
    `STC rebate values are indicative only and subject to market conditions at the time of installation.`,
    `All works are subject to grid connection approval from the relevant DNSP. Connection timelines are outside our control.`,
    `Payment terms: 30% deposit upon acceptance, 40% prior to delivery, 30% upon practical completion.`,
  ]

  return (
    <Document
      title={`${data.quoteNumber} — ${data.projectName}`}
      author="Smart Commercial Solar"
    >
      {/* PAGE 1: Cover & Inclusions */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>Smart Commercial Solar</Text>
            <Text style={styles.companyTagline}>Commercial & Industrial Solar Solutions</Text>
          </View>
          <View>
            <Text style={styles.quoteNumber}>{data.quoteNumber}</Text>
            <Text style={styles.quoteDate}>Issued: {data.generatedDate}</Text>
            {data.validUntil && <Text style={styles.quoteDate}>Valid until: {data.validUntil}</Text>}
          </View>
        </View>

        {/* Project title */}
        <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 12, color: DARK }}>
          {data.projectName}
        </Text>

        {/* Customer & Site */}
        <View style={styles.customerBlock}>
          <View style={styles.customerCol}>
            <Text style={styles.label}>Prepared for</Text>
            <Text style={{ ...styles.value, fontFamily: 'Helvetica-Bold' }}>{data.customerName}</Text>
            {data.customerCompany ? <Text style={styles.value}>{data.customerCompany}</Text> : null}
            {data.customerAbn ? <Text style={styles.value}>ABN: {data.customerAbn}</Text> : null}
          </View>
          <View style={styles.customerCol}>
            <Text style={styles.label}>Installation address</Text>
            <Text style={styles.value}>{data.siteAddress}</Text>
            {data.dnsp ? <Text style={{ ...styles.value, marginTop: 4 }}>DNSP: {data.dnsp}</Text> : null}
          </View>
          <View style={styles.customerCol}>
            <Text style={styles.label}>System specification</Text>
            <Text style={styles.value}>{data.systemKw} kWp solar PV</Text>
            {data.systemKva ? <Text style={styles.value}>{data.systemKva} kVA</Text> : null}
            <Text style={{ ...styles.value, marginTop: 4 }}>Price table: {data.priceVersionName}</Text>
          </View>
        </View>

        {/* Inclusions table */}
        <Text style={styles.sectionHeading}>Scope of Works — Inclusions</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.headerText, ...styles.colCode }}>Code</Text>
            <Text style={{ ...styles.headerText, ...styles.colDesc }}>Description</Text>
            <Text style={{ ...styles.headerText, ...styles.colQty }}>Qty</Text>
            <Text style={{ ...styles.headerText, ...styles.colUnit }}>Unit</Text>
            <Text style={{ ...styles.headerText, ...styles.colTotal }}>Total (ex GST)</Text>
          </View>
          {data.includedItems.map((item, idx) => (
            <View key={item.code} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={{ ...styles.cellText, ...styles.colCode, color: MEDIUM, fontFamily: 'Helvetica-Oblique', fontSize: 7.5 }}>
                {item.code}
              </Text>
              <View style={styles.colDesc}>
                <Text style={styles.cellText}>{item.name}</Text>
                {item.modifier_note && (
                  <Text style={styles.cellTextMuted}>↳ {item.modifier_note}</Text>
                )}
              </View>
              <Text style={{ ...styles.cellText, ...styles.colQty }}>{item.qty}</Text>
              <Text style={{ ...styles.cellText, ...styles.colUnit, color: MEDIUM }}>{item.unit}</Text>
              <Text style={{ ...styles.cellText, ...styles.colTotal }}>{fmtAUD(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal (ex GST)</Text>
            <Text style={styles.totalValue}>{fmtAUD(data.totals.subtotal)}</Text>
          </View>
          {data.rebates.length > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Rebates & Incentives</Text>
              <Text style={{ ...styles.totalValue, color: BRAND_GREEN }}>{fmtAUD(data.totals.rebateTotal)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Net price (ex GST)</Text>
            <Text style={styles.totalValue}>{fmtAUD(data.totals.netBeforeGST)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST (10%)</Text>
            <Text style={styles.totalValue}>{fmtAUD(data.totals.gst)}</Text>
          </View>
          <View style={{ ...styles.totalRow, marginTop: 4 }}>
            <Text style={styles.grandTotalLabel}>Total (inc GST)</Text>
            <Text style={styles.grandTotalValue}>{fmtAUD(data.totals.total)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Smart Commercial Solar — Confidential</Text>
          <Text style={styles.pageNum} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* PAGE 2: Rebates, Exclusions & Disclaimers */}
      <Page size="A4" style={styles.page}>
        {/* Header repeat */}
        <View style={{ ...styles.header, marginBottom: 16 }}>
          <Text style={{ ...styles.companyName, fontSize: 12 }}>Smart Commercial Solar</Text>
          <Text style={styles.quoteNumber}>{data.quoteNumber}</Text>
        </View>

        {/* Rebates */}
        {data.rebates.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Rebates & Incentives Applied</Text>
            {data.rebates.map((r) => (
              <View key={r.name} style={styles.rebateRow}>
                <Text style={styles.rebateLabel}>{r.name}</Text>
                <Text style={styles.rebateValue}>{fmtAUD(r.value)}</Text>
              </View>
            ))}
            <Text style={{ ...styles.disclaimer, marginBottom: 12 }}>
              Rebate values are estimates only. Actual values depend on market conditions, system performance, and regulatory approval.
            </Text>
          </>
        )}

        {/* Exclusions */}
        {data.excludedItemNames.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Exclusions</Text>
            {data.excludedItemNames.map((name) => (
              <Text key={name} style={styles.exclusionItem}>• {name}</Text>
            ))}
          </>
        )}

        {/* Disclaimers */}
        <Text style={{ ...styles.sectionHeading, marginTop: 20 }}>Terms & Conditions</Text>
        {DISCLAIMER.map((line, i) => (
          <Text key={i} style={styles.disclaimer}>• {line}</Text>
        ))}

        {/* Acceptance block */}
        <Text style={{ ...styles.sectionHeading, marginTop: 24 }}>Acceptance</Text>
        <View style={{ flexDirection: 'row', gap: 40, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Authorised by (client)</Text>
            <View style={{ borderBottomWidth: 1, borderBottomColor: BORDER, marginTop: 24, marginBottom: 4 }} />
            <Text style={styles.label}>Name / Signature / Date</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Prepared by (SCS)</Text>
            <View style={{ borderBottomWidth: 1, borderBottomColor: BORDER, marginTop: 24, marginBottom: 4 }} />
            <Text style={styles.label}>Name / Signature / Date</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Smart Commercial Solar — Confidential</Text>
          <Text style={styles.pageNum} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

// ============================================================
// Generator function
// ============================================================

export async function generateAndDownloadPDF(data: PDFQuoteData): Promise<void> {
  const blob = await pdf(<QuotePDFDocument data={data} />).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const safeProject = (data.projectName || 'Quote').replace(/[^a-zA-Z0-9\s-_]/g, '').trim().replace(/\s+/g, '_')
  const safeCustomer = (data.customerName || '').replace(/[^a-zA-Z0-9\s-_]/g, '').trim().replace(/\s+/g, '_')
  link.download = `${data.quoteNumber}_${safeCustomer}_${safeProject}_Execution.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
