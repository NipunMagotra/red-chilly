import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import { GuestTabSession } from '@/lib/data/restaurant-data'

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: '#dc2626',
    paddingBottom: 16,
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#991b1b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  brandSubtitle: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  invoiceTitleBadge: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    textAlign: 'right',
  },
  invoiceTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#991b1b',
  },
  invoiceNumber: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#475569',
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 6,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  metaSub: {
    fontSize: 8,
    color: '#475569',
  },
  roundSection: {
    marginBottom: 14,
  },
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  roundTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
  },
  roundTime: {
    fontSize: 8,
    color: '#64748b',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 4,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  colDesc: {
    flex: 5,
  },
  colQty: {
    flex: 1,
    textAlign: 'center',
  },
  colPrice: {
    flex: 2,
    textAlign: 'right',
  },
  colTotal: {
    flex: 2,
    textAlign: 'right',
  },
  itemText: {
    fontSize: 9,
    color: '#1e293b',
  },
  itemNotes: {
    fontSize: 8,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 1,
  },
  itemVoided: {
    fontSize: 8,
    color: '#dc2626',
    fontFamily: 'Helvetica-Bold',
    marginTop: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
    marginBottom: 18,
  },
  summaryBox: {
    width: 220,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderTopColor: '#dc2626',
    paddingTop: 6,
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#991b1b',
  },
  summaryTotalValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#991b1b',
  },
  stampBox: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 6,
    textAlign: 'center',
    marginBottom: 14,
  },
  stampText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#059669',
    letterSpacing: 0.5,
  },
  stampSub: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
  },
  checksumBox: {
    backgroundColor: '#f1f5f9',
    padding: 6,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
    marginBottom: 10,
  },
  checksumLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
  },
  checksumValue: {
    fontSize: 7,
    fontFamily: 'Courier',
    color: '#334155',
    marginTop: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
})

interface DiningInvoicePdfProps {
  session: GuestTabSession
}

export function DiningInvoicePdfDocument({ session }: DiningInvoicePdfProps) {
  const invoiceNum =
    session.invoiceNumber ||
    `INV-${session.locationIdentifier.toUpperCase()}-${session.id.slice(-6)}`

  const formattedDate = session.settledAt
    ? new Date(session.settledAt).toLocaleString()
    : new Date(session.createdAt).toLocaleString()

  const taxRatePercent =
    session.propertyId === 'prop-emerald-bay-resort' ? '9.50%' : '8.25%'

  return (
    <Document title={`Invoice-${invoiceNum}`} author={session.propertyName || 'Red Chilly Resort'}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View>
            <Text style={styles.brandTitle}>{session.propertyName || 'Red Chilly Resort'}</Text>
            <Text style={styles.brandSubtitle}>
              Smart QR Hospitality &amp; Continuous Guest Tab Service
            </Text>
          </View>
          <View style={styles.invoiceTitleBadge}>
            <Text style={styles.invoiceTitle}>DIGITAL DINING FOLIO</Text>
            <Text style={styles.invoiceNumber}>{invoiceNum}</Text>
          </View>
        </View>

        {/* Guest & Stay Meta Grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Guest Name</Text>
            <Text style={styles.metaValue}>{session.guestName}</Text>
            <Text style={styles.metaSub}>Folio Ref: {session.id.slice(-8)}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Room / Station</Text>
            <Text style={styles.metaValue}>{session.locationName}</Text>
            <Text style={styles.metaSub}>Type: {session.locationType.toUpperCase()}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Date &amp; Time</Text>
            <Text style={styles.metaValue}>{formattedDate}</Text>
            <Text style={styles.metaSub}>
              Status: {session.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Table Column Headers */}
        <View style={styles.tableHeader}>
          <Text style={[styles.colDesc, styles.metaLabel]}>Item Description</Text>
          <Text style={[styles.colQty, styles.metaLabel]}>Qty</Text>
          <Text style={[styles.colPrice, styles.metaLabel]}>Unit Price</Text>
          <Text style={[styles.colTotal, styles.metaLabel]}>Amount</Text>
        </View>

        {/* Itemized Order Rounds */}
        {session.rounds.map((round) => (
          <View key={round.id} style={styles.roundSection}>
            <View style={styles.roundHeader}>
              <Text style={styles.roundTitle}>
                Round #{round.roundNumber} &bull; Kitchen Order ({round.status.toUpperCase()})
              </Text>
              <Text style={styles.roundTime}>
                {new Date(round.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            {round.items.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <View style={styles.colDesc}>
                  <Text style={styles.itemText}>{item.name}</Text>
                  {item.notes && <Text style={styles.itemNotes}>Note: {item.notes}</Text>}
                  {item.isVoided && (
                    <Text style={styles.itemVoided}>
                      [VOIDED: {item.voidReason || 'Out of Stock'}]
                    </Text>
                  )}
                </View>
                <Text style={[styles.colQty, styles.itemText]}>
                  {item.isVoided ? 0 : item.quantity}
                </Text>
                <Text style={[styles.colPrice, styles.itemText]}>
                  ₹{item.price.toFixed(2)}
                </Text>
                <Text style={[styles.colTotal, styles.itemText]}>
                  ₹{(item.isVoided ? 0 : item.subtotal || item.price * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {/* Financial Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={{ fontSize: 9, color: '#475569' }}>Food &amp; Beverage Subtotal</Text>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>
                ₹{session.subtotal.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={{ fontSize: 9, color: '#475569' }}>Resort Tax ({taxRatePercent})</Text>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>
                ₹{session.tax.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>Total Folio Amount</Text>
              <Text style={styles.summaryTotalValue}>
                ₹{session.totalAmount.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Settlement Stamp */}
        <View style={styles.stampBox}>
          <Text style={styles.stampText}>
            {session.status === 'settled'
              ? 'PAID & CHARGED TO GUEST ROOM FOLIO'
              : 'CONTINUOUS STAY TAB ACTIVE'}
          </Text>
          <Text style={styles.stampSub}>
            Payment Method: {session.paymentMethod ? session.paymentMethod.replace('_', ' ').toUpperCase() : 'ROOM FOLIO'} &bull; Settled at Front Desk
          </Text>
        </View>

        {/* SHA-256 Digital Verification Checksum */}
        {session.invoiceChecksum && (
          <View style={styles.checksumBox}>
            <Text style={styles.checksumLabel}>Tamper-Evident SHA-256 Digital Verification Checksum</Text>
            <Text style={styles.checksumValue}>{session.invoiceChecksum}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Thank you for dining with {session.propertyName || 'Red Chilly Luxury Resort'}. For billing inquiries, contact reception at ext. 0.
        </Text>
      </Page>
    </Document>
  )
}
