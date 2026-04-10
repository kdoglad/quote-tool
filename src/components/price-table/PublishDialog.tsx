import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useToast } from '../ui/Toast'
import Dialog from '../ui/Dialog'
import Button from '../ui/Button'
import Input from '../ui/Input'

interface PublishDialogProps {
  sourceVersionId: string
  sourceVersionName: string
  onClose: () => void
  onPublished: () => void
}

export default function PublishDialog({
  sourceVersionId,
  sourceVersionName,
  onClose,
  onPublished,
}: PublishDialogProps) {
  const { profile } = useAuthStore()
  const { addToast } = useToast()
  const [newVersionName, setNewVersionName] = useState(suggestNextVersion(sourceVersionName))
  const [notes, setNotes] = useState('')
  const [publishing, setPublishing] = useState(false)

  async function handlePublish() {
    if (!newVersionName.trim() || !profile) return
    setPublishing(true)

    try {
      const { error } = await supabase.rpc('publish_price_version', {
        p_source_version_id: sourceVersionId,
        p_new_version_name: newVersionName.trim(),
        p_notes: notes.trim(),
        p_published_by: profile.id,
      })

      if (error) throw error

      addToast('success', `Version "${newVersionName}" published successfully.`)
      onPublished()
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to publish version')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Publish Price Version"
      description={`Publishing "${sourceVersionName}" will create a permanent, immutable snapshot. All future quotes can reference this version.`}
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 p-3 bg-amber-900/20 border border-amber-800 rounded-lg text-sm text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            Once published, line item prices and formulas in this version <strong>cannot be edited</strong>.
            Create a new draft version for future changes.
          </div>
        </div>

        <Input
          label="New published version name"
          value={newVersionName}
          onChange={(e) => setNewVersionName(e.target.value)}
          placeholder="e.g. FY25 V23.0"
        />

        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Changelog notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What changed in this version? Which line items were updated and why?"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white
                       placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500
                       px-3 py-2 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={publishing}>Cancel</Button>
          <Button
            variant="primary"
            loading={publishing}
            disabled={!newVersionName.trim()}
            onClick={handlePublish}
          >
            Publish Version
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function suggestNextVersion(name: string): string {
  // Try to increment the last number in the version name
  const match = name.match(/^(.*?)(\d+(?:\.\d+)?)$/)
  if (!match) return name + ' (new)'
  const base = match[1]
  const num = match[2]
  const parts = num.split('.')
  const last = parseInt(parts[parts.length - 1]) + 1
  parts[parts.length - 1] = String(last)
  return base + parts.join('.')
}
