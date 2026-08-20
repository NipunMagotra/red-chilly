import crypto from 'crypto'

export interface AuditLogRecord {
  id: string
  actorId: string
  actorName: string
  actorRole: string
  propertyId: string
  action:
    | 'GUEST_CHECK_IN'
    | 'PIN_ROTATION'
    | 'ORDER_APPEND'
    | 'ITEM_VOID'
    | 'TAB_SETTLED'
    | 'TAB_CLOSED'
    | 'STAFF_LOGIN'
    | 'STAFF_LOGOUT'
  targetResource: string
  targetResourceType: 'location' | 'guest_session' | 'order_round' | 'order_item'
  previousState?: Record<string, unknown>
  newState?: Record<string, unknown>
  reason?: string
  idempotencyKey?: string
  timestamp: string
}

class AuditLogger {
  private logs: AuditLogRecord[] = []

  /**
   * Records an immutable audit log entry for sensitive operations.
   */
  logEvent(
    event: Omit<AuditLogRecord, 'id' | 'timestamp'>
  ): AuditLogRecord {
    const record: AuditLogRecord = {
      ...event,
      id: `audit-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
    }

    this.logs.push(record)

    // Console logging in structured JSON format for observability
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[AUDIT_LOG] [${record.action}] property=${record.propertyId} actor=${record.actorName} (${record.actorRole}) target=${record.targetResource} reason="${record.reason || 'N/A'}"`)
    }

    return record
  }

  getLogsByProperty(propertyId: string): AuditLogRecord[] {
    return this.logs
      .filter((l) => l.propertyId === propertyId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  getLogsByTarget(targetResource: string): AuditLogRecord[] {
    return this.logs
      .filter((l) => l.targetResource === targetResource)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  getAllLogs(): AuditLogRecord[] {
    return [...this.logs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }
}

// Global Singleton Instance
declare global {
  // eslint-disable-next-line no-var
  var globalAuditLogger: AuditLogger | undefined
}

export const auditLogger = globalThis.globalAuditLogger || new AuditLogger()
if (process.env.NODE_ENV !== 'production') {
  globalThis.globalAuditLogger = auditLogger
}
