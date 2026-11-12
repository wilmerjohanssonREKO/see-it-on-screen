import type { ComponentType } from 'react'
import { template as uppdragAvbokat } from './uppdrag-avbokat'
import { template as uppdragTilldelat } from './uppdrag-tilldelat'
import { template as vikarieTilldelad } from './vikarie-tilldelad'
import { template as schoolInvitation } from './school-invitation'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'uppdrag-avbokat': uppdragAvbokat,
  'uppdrag-tilldelat': uppdragTilldelat,
  'vikarie-tilldelad': vikarieTilldelad,
  'school-invitation': schoolInvitation,
}
