import type { DNSPRule } from '../types/domain.types'

/**
 * Extract the 2-digit NMI prefix from an NMI string.
 * NMIs are typically 10 alphanumeric characters.
 */
export function extractNMIPrefix(nmi: string): string {
  return nmi.replace(/\s/g, '').substring(0, 2).toUpperCase()
}

/**
 * Look up the DNSP for a given NMI prefix against a list of DNSP rules.
 * Returns null if no match found.
 */
export function resolveDNSP(nmiPrefix: string, dnspRules: DNSPRule[]): DNSPRule | null {
  if (!nmiPrefix || nmiPrefix.length < 2) return null
  return dnspRules.find((rule) =>
    rule.nmi_prefixes.some((prefix) => nmiPrefix.startsWith(prefix))
  ) ?? null
}

/**
 * Build the DNSP-related formula scope variables from a DNSP rule + system size.
 */
export function buildDNSPScope(
  dnsp: DNSPRule | null,
  systemKw: number
): {
  dnsp_application_fee: number
  dnsp_study_threshold: number
  dnsp_study_fee: number
} {
  if (!dnsp) {
    return {
      dnsp_application_fee: 0,
      dnsp_study_threshold: 30,
      dnsp_study_fee: 0,
    }
  }

  const studyThreshold = dnsp.rules_json.connection_study_threshold_kw ?? 30
  const studyFee = dnsp.rules_json.connection_study_fee ?? 0

  return {
    dnsp_application_fee: dnsp.application_fee,
    dnsp_study_threshold: studyThreshold,
    dnsp_study_fee: systemKw >= studyThreshold ? studyFee : 0,
  }
}

/**
 * Infer the Australian state from a DNSP rule.
 * Used to auto-populate state when the NMI is known.
 */
export function inferStateFromDNSP(dnsp: DNSPRule | null): string {
  return dnsp?.state ?? ''
}
