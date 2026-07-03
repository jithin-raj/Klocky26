import {
  Component, ChangeDetectionStrategy, signal, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecruitmentService } from '../../../../core/services/recruitment.service';
import { ToastService } from '../../../../shared/components/ui-toast/toast.service';
import { Interview, InterviewFeedback } from '../../../../core/models/recruitment.model';

@Component({
  selector: 'app-interviews',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './interviews.component.html',
  styleUrl: './interviews.component.scss',
})
export class InterviewsComponent implements OnInit {

  private readonly svc   = inject(RecruitmentService);
  private readonly toast = inject(ToastService);

  interviews  = signal<Interview[]>([]);
  loading     = signal(true);
  submitting  = signal<string | null>(null);   // id currently being submitted
  openFeedback = signal<string | null>(null);  // id whose inline form is open

  // Per-card feedback form state (keyed by id)
  feedbackText   = signal<Record<string, string | undefined>>({});
  feedbackStatus = signal<Record<string, 'completed' | 'cancelled' | undefined>>({});

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.getMyInterviews().subscribe({
      next: (list) => { this.interviews.set(list); this.loading.set(false); },
      error: ()     => { this.loading.set(false); this.toast.error('Failed to load interviews'); },
    });
  }

  toggleFeedback(id: string) {
    this.openFeedback.set(this.openFeedback() === id ? null : id);
    // initialise defaults
    this.feedbackText.update(m => ({ ...m, [id]: m[id] ?? '' }));
    this.feedbackStatus.update(m => ({ ...m, [id]: m[id] ?? 'completed' }));
  }

  setFeedbackText(id: string, v: string) {
    this.feedbackText.update(m => ({ ...m, [id]: v }));
  }

  setFeedbackStatus(id: string, v: 'completed' | 'cancelled') {
    this.feedbackStatus.update(m => ({ ...m, [id]: v }));
  }

  submitFeedback(id: string) {
    const body: InterviewFeedback = {
      feedback: this.feedbackText()[id] ?? '',
      status:   this.feedbackStatus()[id] ?? 'completed',
    };
    if (!body.feedback.trim()) {
      this.toast.warning('Please enter feedback before submitting.');
      return;
    }
    this.submitting.set(id);
    this.svc.submitFeedback(id, body).subscribe({
      next: () => {
        this.submitting.set(null);
        this.openFeedback.set(null);
        this.toast.success('Feedback submitted');
        this.load();
      },
      error: (err) => {
        this.submitting.set(null);
        this.toast.error('Could not submit feedback', err?.error?.message ?? 'Please try again.');
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium', timeStyle: 'short',
    });
  }

  modeLabel(m: string): string {
    return m === 'in_person' ? 'In Person' : m.charAt(0).toUpperCase() + m.slice(1);
  }
}
