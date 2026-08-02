import { Component, ChangeDetectionStrategy, Input, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PayrollService } from '../../../../core/services/payroll.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { triggerBlobDownload } from '../../../../core/utils/file-download.util';
import {
  PayslipBlockType, PayslipTemplateFieldDto, PayslipTemplateDto, PayslipTemplateBlockInput,
} from '../../../../core/models/payroll.model';

interface CanvasBlock {
  _key: number;
  type: PayslipBlockType;
  fieldKey: string | null;
  /** Heading text (type 'heading'), or a label override (type 'field'), else unused. */
  label: string;
}

interface LayoutBlockDef {
  type: PayslipBlockType;
  label: string;
  hint: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drag-and-drop payslip template builder. Deliberately built on native HTML5
// drag events (no @angular/cdk dependency — not installed in this project and
// the rest of the app's UI primitives are hand-rolled the same way). Every
// drag interaction has a non-drag equivalent (▲▼ move buttons, tap-to-add)
// since native HTML5 DnD doesn't work on touch devices.
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-payslip-template-builder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './payslip-template-builder.component.html',
  styleUrl: './payslip-template-builder.component.scss',
})
export class PayslipTemplateBuilderComponent implements OnInit {
  private readonly payrollSvc = inject(PayrollService);
  private readonly toast = inject(ToastService);

  @Input() canEdit = true;

  /** Cosmetic only, for the document-style canvas preview — never sent to the server. */
  readonly sampleLineItems: { name: string; amount: string; type: 'earning' | 'deduction' }[] = [
    { name: 'Basic', amount: '25,000', type: 'earning' },
    { name: 'HRA', amount: '10,000', type: 'earning' },
    { name: 'Provident Fund', amount: '1,800', type: 'deduction' },
    { name: 'Professional Tax', amount: '200', type: 'deduction' },
  ];

  readonly layoutBlockDefs: LayoutBlockDef[] = [
    { type: 'heading', label: 'Heading', hint: 'A text heading you write yourself' },
    { type: 'logo', label: 'Company Logo', hint: 'Blank on the PDF if no logo is set in Settings → Company Profile' },
    { type: 'line-items-table', label: 'Earnings & Deductions Table', hint: "Auto-generated from the payslip's real line items" },
    { type: 'spacer', label: 'Spacer', hint: 'Adds vertical space' },
  ];

  fields = signal<PayslipTemplateFieldDto[]>([]);
  readonly fieldCategories = computed(() => {
    const groups = new Map<string, PayslipTemplateFieldDto[]>();
    for (const f of this.fields()) {
      if (!groups.has(f.category)) groups.set(f.category, []);
      groups.get(f.category)!.push(f);
    }
    return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
  });

  blocks = signal<CanvasBlock[]>([]);
  loading = signal(true);
  saving = signal(false);
  previewing = signal(false);
  dirty = signal(false);
  private _nextKey = 0;

  readonly validationError = computed(() => {
    const list = this.blocks();
    if (!list.length) return 'Add at least one block to the layout.';
    if (list.some(b => b.type === 'heading' && !b.label.trim())) return 'Every heading needs text.';
    return null;
  });

  // ── Drag state (palette → canvas, or canvas reorder) ─────────────────────
  private _dragPayload: { type: PayslipBlockType; fieldKey: string | null; label: string } | null = null;
  private _draggingIndex: number | null = null;
  dragOverIndex = signal<number | null>(null);

  ngOnInit(): void {
    this.payrollSvc.getTemplateFields().subscribe({ next: (f) => this.fields.set(f), error: () => {} });
    this.loadTemplate();
  }

  loadTemplate(): void {
    this.loading.set(true);
    this.payrollSvc.getTemplate().subscribe({
      next: (t) => { this._applyTemplate(t); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  private _applyTemplate(t: PayslipTemplateDto): void {
    this.blocks.set(
      [...t.blocks].sort((a, b) => a.sortOrder - b.sortOrder).map(b => ({
        _key: this._nextKey++,
        type: b.type,
        fieldKey: b.fieldKey ?? null,
        label: b.label ?? (b.type === 'field' ? this.defaultLabelFor(b.fieldKey) : ''),
      })),
    );
    this.dirty.set(false);
  }

  private defaultLabelFor(key: string | null | undefined): string {
    return this.fields().find(f => f.key === key)?.defaultLabel ?? key ?? '';
  }

  // ── Palette → canvas (tap-to-add, always available) ──────────────────────
  addField(f: PayslipTemplateFieldDto): void {
    if (!this.canEdit) return;
    this._insertAt(this.blocks().length, { type: 'field', fieldKey: f.key, label: f.defaultLabel });
  }

  addLayoutBlock(type: PayslipBlockType): void {
    if (!this.canEdit) return;
    this._insertAt(this.blocks().length, { type, fieldKey: null, label: type === 'heading' ? 'New Heading' : '' });
  }

  private _insertAt(index: number, payload: { type: PayslipBlockType; fieldKey: string | null; label: string }): void {
    const block: CanvasBlock = { _key: this._nextKey++, ...payload };
    this.blocks.update(list => {
      const copy = [...list];
      copy.splice(index, 0, block);
      return copy;
    });
    this.dirty.set(true);
  }

  removeBlock(key: number): void {
    if (!this.canEdit) return;
    this.blocks.update(list => list.filter(b => b._key !== key));
    this.dirty.set(true);
  }

  updateLabel(key: number, value: string): void {
    this.blocks.update(list => list.map(b => b._key === key ? { ...b, label: value } : b));
    this.dirty.set(true);
  }

  moveUp(i: number): void {
    if (i > 0) this.moveBlock(i, i - 1);
  }

  moveDown(i: number): void {
    if (i < this.blocks().length - 1) this.moveBlock(i, i + 2);
  }

  private moveBlock(from: number, to: number): void {
    if (from === to) return;
    this.blocks.update(list => {
      const copy = [...list];
      const [item] = copy.splice(from, 1);
      const insertAt = to > from ? to - 1 : to;
      copy.splice(insertAt, 0, item);
      return copy;
    });
    this.dirty.set(true);
  }

  // ── Native HTML5 drag-and-drop ────────────────────────────────────────────
  onPaletteFieldDragStart(event: DragEvent, f: PayslipTemplateFieldDto): void {
    if (!this.canEdit) return;
    this._draggingIndex = null;
    this._dragPayload = { type: 'field', fieldKey: f.key, label: f.defaultLabel };
    event.dataTransfer?.setData('text/plain', f.key);
  }

  onPaletteLayoutDragStart(event: DragEvent, type: PayslipBlockType): void {
    if (!this.canEdit) return;
    this._draggingIndex = null;
    this._dragPayload = { type, fieldKey: null, label: type === 'heading' ? 'New Heading' : '' };
    event.dataTransfer?.setData('text/plain', type);
  }

  onBlockDragStart(event: DragEvent, index: number): void {
    if (!this.canEdit) return;
    this._dragPayload = null;
    this._draggingIndex = index;
    event.dataTransfer?.setData('text/plain', String(index));
  }

  onCanvasDragOver(event: DragEvent, index: number): void {
    if (!this.canEdit) return;
    event.preventDefault();
    this.dragOverIndex.set(index);
  }

  onDrop(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    if (!this.canEdit) return;
    if (this._dragPayload) {
      this._insertAt(targetIndex, this._dragPayload);
    } else if (this._draggingIndex !== null) {
      this.moveBlock(this._draggingIndex, targetIndex);
    }
    this.onDragEnd();
  }

  onDragEnd(): void {
    this._dragPayload = null;
    this._draggingIndex = null;
    this.dragOverIndex.set(null);
  }

  // ── Sample value shown in the canvas so the layout is easier to picture ──
  sampleFor(fieldKey: string | null): string {
    if (!fieldKey) return '';
    const k = fieldKey.toLowerCase();
    if (k.includes('name')) return 'Jane Doe';
    if (k.includes('date')) return '01 Jul 2026';
    if (k.includes('code') || k.includes('id')) return 'EMP-0231';
    if (k.includes('pay') || k.includes('salary') || k.includes('amount') || k.includes('ctc') || k.includes('gross') || k.includes('deduction') || k.includes('net')) return '₹42,500';
    if (k.includes('days')) return '22';
    return 'Sample value';
  }

  layoutBlockLabel(type: PayslipBlockType): string {
    return this.layoutBlockDefs.find(d => d.type === type)?.label ?? type;
  }

  private _toRequestBlocks(): PayslipTemplateBlockInput[] {
    return this.blocks().map((b, i) => ({
      type: b.type,
      fieldKey: b.type === 'field' ? b.fieldKey : null,
      label: b.type === 'heading' ? b.label.trim() : (b.type === 'field' ? (b.label.trim() || null) : null),
      sortOrder: i,
    }));
  }

  save(): void {
    if (!this.canEdit || this.saving() || this.validationError()) return;
    this.saving.set(true);
    this.payrollSvc.updateTemplate({ blocks: this._toRequestBlocks() }).subscribe({
      next: (t) => {
        this.saving.set(false);
        this._applyTemplate(t);
        this.toast.success('Template saved', 'New payslip PDFs will use this layout.');
      },
      error: (err) => {
        this.saving.set(false);
        // Backend validates fieldKey against the real catalog, heading text,
        // and the fixed block-type set — its message is specific, show it directly.
        this.toast.error('Could not save template', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
      },
    });
  }

  /**
   * Saves the current draft (if changed) then downloads a real payslip's PDF
   * so the admin can see the template actually applied — there is no separate
   * "render with sample data" endpoint, so this reuses a real payslip.
   */
  previewPdf(): void {
    if (this.previewing() || this.validationError()) return;
    this.previewing.set(true);
    if (this.dirty()) {
      this.payrollSvc.updateTemplate({ blocks: this._toRequestBlocks() }).subscribe({
        next: (t) => { this._applyTemplate(t); this._downloadPreviewPdf(); },
        error: (err) => {
          this.previewing.set(false);
          this.toast.error('Could not save template', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
        },
      });
    } else {
      this._downloadPreviewPdf();
    }
  }

  private _downloadPreviewPdf(): void {
    const now = new Date();
    this.payrollSvc.getPayslips(now.getFullYear(), now.getMonth() + 1).subscribe({
      next: (list) => {
        const target = list[0];
        if (!target) {
          this.previewing.set(false);
          this.toast.info('No payslip to preview yet', 'Generate at least one payslip in Run Payroll, then come back to preview against it.');
          return;
        }
        this.payrollSvc.downloadPayslipPdf(target.id).subscribe({
          next: (blob) => {
            this.previewing.set(false);
            triggerBlobDownload(blob, `template-preview-${target.employeeName.replace(/\s+/g, '-')}.pdf`);
          },
          error: () => { this.previewing.set(false); this.toast.error('Could not generate preview', 'Please try again.'); },
        });
      },
      error: () => { this.previewing.set(false); this.toast.error('Could not generate preview', 'Please try again.'); },
    });
  }
}
