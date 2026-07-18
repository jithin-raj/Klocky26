import {
  Component, ChangeDetectionStrategy, inject, signal, computed, ElementRef, ViewChild, AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { AiService } from '../../../../core/services/ai.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { AiReportCardComponent } from '../../../../shared/components/ai-report-card/ai-report-card.component';
import { AiChatMessage, AiScope, AiReportType } from '../../../../core/models/ai.model';

interface ChatBubble {
  role: 'user' | 'assistant';
  content: string;
  html?: SafeHtml;
}

// ─────────────────────────────────────────────────────────────────────────────
// AiAssistantComponent — dedicated /app/ai screen. Replaces the old floating
// chat widget + inline report cards scattered across dashboards/report pages:
// AI is now permission-gated (see sidebar's permKey/permLevel on this route),
// not shown to everyone by default, so it belongs on its own screen rather
// than a global overlay every user would see regardless of access.
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, AiReportCardComponent],
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.scss',
})
export class AiAssistantComponent implements AfterViewChecked {
  @ViewChild('scrollEl') scrollEl?: ElementRef<HTMLElement>;

  private readonly ai = inject(AiService);
  private readonly appState = inject(AppStateService);
  private readonly orgNav = inject(OrgNavigationService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly available = this.ai.available;
  readonly locked = this.ai.locked;

  readonly reportTypes: { type: AiReportType; label: string }[] = [
    { type: 'overview', label: 'Overview' },
    { type: 'attendance', label: 'Attendance' },
    { type: 'leave', label: 'Leave' },
    { type: 'performance', label: 'Performance' },
  ];

  messages = signal<ChatBubble[]>([]);
  input = signal('');
  sending = signal(false);
  sendError = signal('');
  lastScope = signal<AiScope | null>(null);
  copiedIndex = signal<number | null>(null);

  private _shouldScroll = false;

  readonly isAdminOrHr = computed(() => {
    const u = this.appState.user();
    return !!(u?.isAdmin || u?.isHr || u?.isManager);
  });

  readonly suggestions = computed<string[]>(() =>
    this.isAdminOrHr()
      ? ['Who was absent most this cycle?', "Summarise today's attendance", 'Any pending approvals?', 'Any upcoming holidays?']
      : ['How many leaves do I have left?', 'My attendance this month', 'My open tasks']);

  readonly hasMessages = computed(() => this.messages().length > 0);

  ngAfterViewChecked(): void {
    if (this._shouldScroll) {
      this._shouldScroll = false;
      const el = this.scrollEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }

  goToBilling(): void {
    this.orgNav.navigate(['app', 'billing']);
  }

  useSuggestion(text: string): void {
    this.send(text);
  }

  send(text?: string): void {
    const message = (text ?? this.input()).trim();
    if (!message || this.sending()) return; // empty disabled; simple in-flight guard debounces rapid sends

    const history: AiChatMessage[] = this.messages().slice(-8).map(m => ({ role: m.role, content: m.content }));

    this.messages.update(list => [...list, { role: 'user', content: message }]);
    this.input.set('');
    this.sending.set(true);
    this.sendError.set('');
    this._shouldScroll = true;

    this.ai.chat(message, history).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.lastScope.set(res.scope);
        const html = marked.parse(res.answer ?? '', { async: false }) as string;
        this.messages.update(list => [...list, {
          role: 'assistant', content: res.answer, html: this.sanitizer.bypassSecurityTrustHtml(html),
        }]);
        this._shouldScroll = true;
      },
      error: (err) => this._handleError(err),
    });
  }

  private _handleError(err: any): void {
    this.sending.set(false);
    if (err?.status === 403 && err?.error?.code === 'feature_not_in_plan') {
      this.ai.markNotEntitled();
      this.toast.info('AI insights not included', 'Upgrade your plan to keep using the AI assistant.');
      this.orgNav.navigate(['app', 'billing']);
      return;
    }
    if (err?.status === 503) {
      this.sendError.set('AI assistant is temporarily unavailable.');
      return;
    }
    this.sendError.set('Something went wrong. Please try again.');
  }

  copy(index: number, content: string): void {
    navigator.clipboard.writeText(content).then(() => {
      this.copiedIndex.set(index);
      setTimeout(() => this.copiedIndex.set(null), 2000);
    }).catch(() => { /* clipboard blocked — nothing else to do */ });
  }
}
