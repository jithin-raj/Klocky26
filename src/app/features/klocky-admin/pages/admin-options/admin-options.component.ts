import {
  Component, ChangeDetectionStrategy, signal, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlatformOptionsService } from '../../../../core/services/platform-options.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { OptionAdmin, CreateOptionRequest, UpdateOptionRequest } from '../../../../core/models/options.model';

interface OptionForm {
  id: string | null;         // null = creating
  category: string;
  code: string;
  label: string;
  extra: string;
  sortOrder: number;
  isActive: boolean;
}

@Component({
  selector: 'app-admin-options',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-options.component.html',
  styleUrl: './admin-options.component.scss',
})
export class AdminOptionsComponent implements OnInit {
  private readonly svc = inject(PlatformOptionsService);
  private readonly toast = inject(ToastService);

  categories = signal<string[]>([]);
  activeCategory = signal<string>('');
  options = signal<OptionAdmin[]>([]);
  loading = signal(true);
  loadingOptions = signal(false);
  error = signal('');
  busy = signal(false);

  editorOpen = signal(false);
  form: OptionForm = this.blank();

  /** Categories whose options include a meaningful `extra` (e.g. country → timezone). */
  private readonly EXTRA_HINT: Record<string, string> = {
    country: 'Default timezone (IANA)',
  };

  ngOnInit(): void { this.loadCategories(); }

  loadCategories(): void {
    this.loading.set(true);
    this.error.set('');
    this.svc.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.loading.set(false);
        if (cats.length) this.selectCategory(cats[0]);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? err?.error?.message ?? 'Could not load categories.');
      },
    });
  }

  selectCategory(cat: string): void {
    this.activeCategory.set(cat);
    this.loadOptions();
  }

  loadOptions(): void {
    const cat = this.activeCategory();
    if (!cat) return;
    this.loadingOptions.set(true);
    this.svc.list(cat, true).subscribe({
      next: (opts) => {
        this.options.set([...opts].sort((a, b) => a.sortOrder - b.sortOrder));
        this.loadingOptions.set(false);
      },
      error: (err) => {
        this.loadingOptions.set(false);
        this.toast.error('Could not load options', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
      },
    });
  }

  extraHint(): string { return this.EXTRA_HINT[this.activeCategory()] ?? 'Extra'; }
  showsExtra(): boolean { return this.activeCategory() === 'country'; }

  // ── Editor ──────────────────────────────────────────────────────────────────
  private blank(): OptionForm {
    return { id: null, category: this.activeCategory(), code: '', label: '', extra: '', sortOrder: this.options().length, isActive: true };
  }

  openNew(): void {
    this.form = this.blank();
    this.editorOpen.set(true);
  }

  openEdit(o: OptionAdmin): void {
    this.form = { id: o.id, category: o.category, code: o.code, label: o.label, extra: o.extra ?? '', sortOrder: o.sortOrder, isActive: o.isActive };
    this.editorOpen.set(true);
  }

  closeEditor(): void { this.editorOpen.set(false); }

  get valid(): boolean {
    return !!this.form.label.trim() && (this.form.id !== null || !!this.form.code.trim());
  }

  save(): void {
    if (!this.valid || this.busy()) return;
    this.busy.set(true);
    const extra = this.form.extra.trim() || null;

    if (this.form.id) {
      const body: UpdateOptionRequest = { label: this.form.label.trim(), extra, sortOrder: this.form.sortOrder ?? 0, isActive: this.form.isActive };
      this.svc.update(this.form.id, body).subscribe({
        next: () => { this.busy.set(false); this.editorOpen.set(false); this.toast.success('Option updated', this.form.label); this.loadOptions(); },
        error: (err) => { this.busy.set(false); this.toast.error('Could not save', err?.error?.error ?? err?.error?.message ?? 'Please try again.'); },
      });
    } else {
      const body: CreateOptionRequest = { category: this.activeCategory(), code: this.form.code.trim(), label: this.form.label.trim(), extra, sortOrder: this.form.sortOrder ?? 0, isActive: this.form.isActive };
      this.svc.create(body).subscribe({
        next: () => { this.busy.set(false); this.editorOpen.set(false); this.toast.success('Option created', this.form.label); this.loadOptions(); },
        error: (err) => { this.busy.set(false); this.toast.error('Could not create', err?.error?.error ?? err?.error?.message ?? 'Please try again.'); },
      });
    }
  }

  toggleActive(o: OptionAdmin): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.svc.update(o.id, { label: o.label, extra: o.extra, sortOrder: o.sortOrder, isActive: !o.isActive }).subscribe({
      next: () => { this.busy.set(false); this.loadOptions(); },
      error: (err) => { this.busy.set(false); this.toast.error('Could not update', err?.error?.error ?? err?.error?.message ?? 'Please try again.'); },
    });
  }

  /** Reorder by nudging sortOrder up/down and swapping with the neighbour. */
  move(o: OptionAdmin, dir: -1 | 1): void {
    if (this.busy()) return;
    const list = this.options();
    const idx = list.findIndex(x => x.id === o.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const other = list[swapIdx];
    this.busy.set(true);
    // Swap their sortOrder values.
    this.svc.update(o.id, { label: o.label, extra: o.extra, sortOrder: other.sortOrder, isActive: o.isActive }).subscribe({
      next: () => {
        this.svc.update(other.id, { label: other.label, extra: other.extra, sortOrder: o.sortOrder, isActive: other.isActive }).subscribe({
          next: () => { this.busy.set(false); this.loadOptions(); },
          error: () => { this.busy.set(false); this.loadOptions(); },
        });
      },
      error: (err) => { this.busy.set(false); this.toast.error('Could not reorder', err?.error?.error ?? err?.error?.message ?? 'Please try again.'); },
    });
  }

  remove(o: OptionAdmin): void {
    if (this.busy()) return;
    if (!window.confirm(`Delete option "${o.label}" (${o.code})?`)) return;
    this.busy.set(true);
    this.svc.delete(o.id).subscribe({
      next: () => { this.busy.set(false); this.toast.success('Option deleted', o.label); this.loadOptions(); },
      error: (err) => {
        this.busy.set(false);
        if (err?.status === 409) {
          this.toast.error('Can\'t delete this option', 'It\'s in use. Deactivate it instead — it hides from new sign-ups but existing orgs keep their value.');
        } else {
          this.toast.error('Could not delete', err?.error?.error ?? err?.error?.message ?? 'Please try again.');
        }
      },
    });
  }

  prettyCategory(cat: string): string {
    return cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
