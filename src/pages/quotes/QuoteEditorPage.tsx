import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, FileDown, GitCompare, ArrowLeft, PanelLeftClose, PanelLeftOpen, Pin, PinOff } from 'lucide-react'
import { useQuoteEditorStore } from '../../stores/quoteEditorStore'
import { usePriceItems } from '../../hooks/usePriceItems'
import { usePriceVersions } from '../../hooks/usePriceVersions'
import { usePriceItemOptions } from '../../hooks/usePriceItemOptions'
import { useComputedLineItems } from '../../hooks/useComputedLineItems'
import { useSaveQuote, useQuote } from '../../hooks/useQuotes'
import { useAuthStore } from '../../stores/authStore'
import { useToast } from '../../components/ui/Toast'
import SiteDetailsForm from '../../components/quote/SiteDetailsForm'
import LineItemsTable from '../../components/quote/LineItemsTable'
import QuoteSummary from '../../components/quote/QuoteSummary'
import CustomLineItemForm from '../../components/quote/CustomLineItemForm'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import type { ModifierType, CustomLineItem, InclusionStatus } from '../../types/domain.types'
import { generateAndDownloadPDF } from '../../lib/pdfGenerator'
import { clsx } from 'clsx'

export default function QuoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { profile } = useAuthStore()

  const isNew = !id || id === 'new'
  const { data: existingQuote } = useQuote(isNew ? undefined : id)

  const {
    quoteId, isDirty, siteDetails, scope,
    selectedVersionId, comparisonVersionId,
    lineItems,
    setSelectedVersion, setComparisonVersion,
    setLineItemState, duplicateLineItem, removeLineItem, addCustomItem,
    markSaved, setQuoteId,
  } = useQuoteEditorStore()

  const { data: versions = [] } = usePriceVersions()
  const { data: priceItems = [], isLoading: itemsLoading } = usePriceItems(selectedVersionId ?? undefined)
  const { data: comparisonItems = [] } = usePriceItems(comparisonVersionId ?? undefined)
  const { data: priceItemOptions = [] } = usePriceItemOptions(priceItems.map((p) => p.id))

  const computedItems = useComputedLineItems(priceItems, lineItems, scope, priceItemOptions)
  const comparisonComputedItems = useComputedLineItems(comparisonItems, [], scope, [])

  const saveQuote = useSaveQuote()

  // Panel state: open = visible, pinned = stays open even when not focused
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [isPanelPinned, setIsPanelPinned] = useState(true)
  const [showCustomItemForm, setShowCustomItemForm] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)

  // Auto-select latest published version if none selected
  useEffect(() => {
    if (!selectedVersionId && versions.length > 0) {
      const latest = versions.find((v) => !v.is_draft)
      if (latest) setSelectedVersion(latest.id)
    }
  }, [versions, selectedVersionId, setSelectedVersion])

  const handleStatusChange = useCallback((instanceId: string, status: InclusionStatus) => {
    setLineItemState(instanceId, { inclusion_status: status })
  }, [setLineItemState])

  const handleQtyChange = useCallback((instanceId: string, qty: number) => {
    setLineItemState(instanceId, { qty })
  }, [setLineItemState])

  const handleModifierChange = useCallback((instanceId: string, type: ModifierType, value: number, note: string) => {
    setLineItemState(instanceId, { modifier_type: type, modifier_value: value, modifier_note: note })
  }, [setLineItemState])

  const handleDuplicate = useCallback((instanceId: string) => {
    duplicateLineItem(instanceId)
    addToast('success', 'Row duplicated — adjust the copy below.')
  }, [duplicateLineItem, addToast])

  const handleRemove = useCallback((instanceId: string) => {
    removeLineItem(instanceId)
  }, [removeLineItem])

  const handleVariantChange = useCallback((instanceId: string, optionId: string | null) => {
    setLineItemState(instanceId, { selected_option_id: optionId })
  }, [setLineItemState])

  const handleAddCustomItem = useCallback((item: CustomLineItem) => {
    addCustomItem(item)
  }, [addCustomItem])

  async function handleSave() {
    if (!profile) return
    try {
      const quoteData = {
        id: quoteId ?? undefined,
        project_name: siteDetails.project_name || 'Untitled Quote',
        customer_name: siteDetails.customer_name || 'Unknown',
        customer_company: siteDetails.customer_company || null,
        customer_email: siteDetails.customer_email || null,
        customer_phone: siteDetails.customer_phone || null,
        customer_abn: siteDetails.customer_abn || null,
        site_address: siteDetails.site_address || '',
        site_suburb: siteDetails.site_suburb || '',
        site_state: siteDetails.site_state || '',
        site_postcode: siteDetails.site_postcode || '',
        nmi: siteDetails.nmi || null,
        dnsp: siteDetails.dnsp || null,
        system_kw: scope.system_kw || null,
        system_kva: scope.system_kva || null,
        has_bess: scope.has_bess ?? false,
        has_ev: scope.has_ev ?? false,
        existing_solar_kw: scope.existing_solar_kw ?? 0,
        price_version_id: selectedVersionId!,
        internal_notes: siteDetails.internal_notes || null,
        created_by: profile.id,
      }
      const saved = await saveQuote.mutateAsync(quoteData)
      setQuoteId(saved.id)
      markSaved()
      addToast('success', `Quote ${saved.quote_number} saved.`)
      if (isNew) navigate(`/quotes/${saved.id}`, { replace: true })
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save quote')
    }
  }

  async function handleGeneratePDF() {
    if (!selectedVersionId) {
      addToast('error', 'Select a price table version first.')
      return
    }
    setGeneratingPDF(true)
    try {
      const version = versions.find((v) => v.id === selectedVersionId)
      const includedItems = computedItems.filter((i) => i.is_included && i.category !== 'Rebates')
      const rebateItems = computedItems.filter((i) => i.is_included && i.category === 'Rebates')
      const excludedItems = computedItems.filter((i) => !i.is_included)

      const subtotal = includedItems.reduce((s, i) => s + i.computed_total, 0)
      const rebateTotal = rebateItems.reduce((s, i) => s + i.computed_total, 0)
      const netBeforeGST = subtotal + rebateTotal
      const gst = netBeforeGST * 0.10
      const total = netBeforeGST + gst

      await generateAndDownloadPDF({
        quoteNumber: existingQuote?.quote_number ?? 'DRAFT',
        projectName: siteDetails.project_name || 'Solar Installation',
        customerName: siteDetails.customer_name,
        customerCompany: siteDetails.customer_company,
        customerAbn: siteDetails.customer_abn,
        siteAddress: `${siteDetails.site_address}, ${siteDetails.site_suburb} ${siteDetails.site_state} ${siteDetails.site_postcode}`,
        siteSuburb: siteDetails.site_suburb,
        siteState: siteDetails.site_state,
        systemKw: scope.system_kw ?? 0,
        systemKva: scope.system_kva ?? 0,
        dnsp: siteDetails.dnsp,
        validUntil: siteDetails.valid_until || '',
        generatedDate: new Date().toLocaleDateString('en-AU'),
        includedItems: includedItems.map((i) => ({
          code: i.code,
          name: i.name,
          qty: i.qty,
          unit: i.unit,
          unit_price: i.base_unit_price,
          total: i.computed_total,
          modifier_note: i.modifier_note ?? undefined,
          is_provisional: i.inclusion_status === 'provisional_sum',
        })),
        excludedItemNames: excludedItems.map((i) =>
          i.inclusion_status === 'appears_adequate'
            ? `${i.name} — appears adequate`
            : i.name
        ),
        rebates: rebateItems.map((i) => ({
          name: i.name,
          value: i.computed_total,
          assumptions: i.formula ?? '',
        })),
        totals: { subtotal, rebateTotal, netBeforeGST, gst, total },
        priceVersionName: version?.version_name ?? '',
      })
      addToast('success', 'PDF generated.')
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setGeneratingPDF(false)
    }
  }

  const publishedVersions = versions.filter((v) => !v.is_draft)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900 shrink-0">
        <button
          onClick={() => navigate('/quotes')}
          className="text-slate-500 hover:text-white transition-colors p-1"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Panel toggle */}
        <button
          onClick={() => setIsPanelOpen((v) => !v)}
          className={clsx(
            'p-1.5 rounded transition-colors',
            isPanelOpen
              ? 'text-brand-400 hover:text-brand-300'
              : 'text-slate-500 hover:text-slate-300'
          )}
          title={isPanelOpen ? 'Collapse site & system panel' : 'Open site & system panel'}
        >
          {isPanelOpen
            ? <PanelLeftClose className="w-4 h-4" />
            : <PanelLeftOpen className="w-4 h-4" />
          }
        </button>

        <div className="flex-1 min-w-0">
          <span className="font-semibold text-white text-sm">
            {isNew ? 'New Quote' : existingQuote?.quote_number ?? 'Loading…'}
          </span>
          {siteDetails.project_name && (
            <span className="text-slate-400 text-sm ml-2 truncate">— {siteDetails.project_name}</span>
          )}
          {isDirty && <span className="ml-2 text-xs text-amber-400">Unsaved</span>}
        </div>

        {/* Price table version selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500 hidden sm:block">Price table:</span>
          <select
            value={selectedVersionId ?? ''}
            onChange={(e) => setSelectedVersion(e.target.value || null)}
            className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-white py-1.5 pl-2 pr-6
                       focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">— Select version —</option>
            {publishedVersions.map((v) => (
              <option key={v.id} value={v.id}>{v.version_name}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            icon={<GitCompare className="w-3.5 h-3.5" />}
            onClick={() => setShowComparison((v) => !v)}
            className={showComparison ? 'text-brand-300' : ''}
          >
            Compare
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileDown className="w-3.5 h-3.5" />}
            loading={generatingPDF}
            onClick={handleGeneratePDF}
          >
            PDF
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={saveQuote.isPending}
            icon={<Save className="w-3.5 h-3.5" />}
            onClick={handleSave}
            disabled={!selectedVersionId}
          >
            Save
          </Button>
        </div>
      </div>

      {/* ── Comparison version bar ───────────────────────────────── */}
      {showComparison && (
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-900/20 border-b border-amber-800/50 shrink-0">
          <span className="text-xs text-amber-400">Compare against:</span>
          <select
            value={comparisonVersionId ?? ''}
            onChange={(e) => setComparisonVersion(e.target.value || null)}
            className="bg-slate-800 border border-amber-800 rounded text-xs text-white py-1 pl-2 pr-6
                       focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">— Select comparison version —</option>
            {publishedVersions.map((v) => (
              <option key={v.id} value={v.id}>{v.version_name}</option>
            ))}
          </select>
          {comparisonVersionId && (
            <span className="text-xs text-amber-400/60">
              Δ column shows current − comparison
            </span>
          )}
        </div>
      )}

      {/* ── Main layout ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel: Site & System ─────────────────────────── */}
        {isPanelOpen && (
          <div className="flex flex-col border-r border-slate-800 bg-slate-950 shrink-0"
               style={{ width: 340 }}>
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Site &amp; System
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsPanelPinned((v) => !v)}
                  className={clsx(
                    'p-1 rounded transition-colors',
                    isPanelPinned ? 'text-brand-400 hover:text-brand-300' : 'text-slate-600 hover:text-slate-400'
                  )}
                  title={isPanelPinned ? 'Unpin panel' : 'Pin panel open'}
                >
                  {isPanelPinned
                    ? <Pin className="w-3.5 h-3.5" />
                    : <PinOff className="w-3.5 h-3.5" />
                  }
                </button>
              </div>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto p-4">
              <SiteDetailsForm />
            </div>
          </div>
        )}

        {/* ── Right area: Line items + Summary ──────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Line items */}
          <div className="flex-1 overflow-y-auto p-4 min-w-0">
            {itemsLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : !selectedVersionId ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                Select a price table version in the top bar to load line items.
              </div>
            ) : (
              <LineItemsTable
                items={computedItems}
                scope={scope}
                comparisonItems={showComparison && comparisonVersionId ? comparisonComputedItems : undefined}
                showComparison={showComparison && !!comparisonVersionId}
                onStatusChange={handleStatusChange}
                onQtyChange={handleQtyChange}
                onModifierChange={handleModifierChange}
                onDuplicate={handleDuplicate}
                onRemove={handleRemove}
                onVariantChange={handleVariantChange}
                onAddCustomItem={() => setShowCustomItemForm(true)}
              />
            )}
          </div>

          {/* Summary sidebar */}
          <div
            className="shrink-0 border-l border-slate-800 overflow-y-auto p-4 bg-slate-950"
            style={{ width: 220 }}
          >
            <QuoteSummary
              items={computedItems}
              systemKw={scope.system_kw ?? 0}
            />
          </div>
        </div>
      </div>

      {/* ── Custom item dialog ───────────────────────────────────── */}
      {showCustomItemForm && (
        <CustomLineItemForm
          onAdd={handleAddCustomItem}
          onClose={() => setShowCustomItemForm(false)}
        />
      )}
    </div>
  )
}
