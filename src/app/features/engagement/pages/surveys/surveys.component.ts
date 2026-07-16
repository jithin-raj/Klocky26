import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent, UiDatePickerComponent } from '../../../../shared/components';
import { OrgDateOnlyPipe } from '../../../../shared/pipes/localization.pipes';

type SurveyStatus = 'active' | 'draft' | 'closed';

interface Survey {
  id: string;
  title: string;
  description: string;
  status: SurveyStatus;
  questions: number;
  responses: number;
  total: number;
  dueDate: string;
  avgScore: number | null;
  category: string;
}

@Component({
  selector: 'app-surveys',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent, UiDatePickerComponent, OrgDateOnlyPipe],
  templateUrl: './surveys.component.html',
  styleUrl: './surveys.component.scss',
})
export class SurveysComponent {
  activeTab = signal<'surveys' | 'results' | 'new'>('surveys');
  filterStatus = signal<string>('');

  readonly filterStatusOptions = [
    { label: 'All', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Draft', value: 'draft' },
    { label: 'Closed', value: 'closed' },
  ];

  private _surveys = signal<Survey[]>([
    { id:'1', title:'Q2 Pulse Survey',          description:'Bi-quarterly employee engagement check-in',       status:'active', questions:10, responses:14, total:20, dueDate:'2026-05-10', avgScore:3.9, category:'Engagement' },
    { id:'2', title:'Remote Work Feedback',      description:'How are you finding the hybrid work policy?',    status:'active', questions:8,  responses:6,  total:20, dueDate:'2026-05-07', avgScore:null,category:'Culture' },
    { id:'3', title:'Manager Effectiveness',     description:'Rate your manager on key leadership dimensions', status:'closed', questions:12, responses:18, total:18, dueDate:'2026-03-31', avgScore:4.1, category:'Leadership' },
    { id:'4', title:'Onboarding Experience',     description:'New hire first-30-day experience survey',        status:'closed', questions:15, responses:3,  total:3,  dueDate:'2026-04-15', avgScore:4.5, category:'Onboarding' },
    { id:'5', title:'Compensation Satisfaction', description:'Anonymous pay-and-benefits satisfaction survey', status:'draft',  questions:6,  responses:0,  total:20, dueDate:'2026-06-01', avgScore:null,category:'Compensation' },
  ]);

  readonly surveys = computed(() => {
    const s = this.filterStatus();
    return s ? this._surveys().filter(sv => sv.status === s) : this._surveys();
  });

  // New survey form
  newTitle    = signal('');
  newDesc     = signal('');
  newCategory = signal('Engagement');
  newDue      = signal('');
  creating    = signal(false);
  created     = signal(false);

  readonly categories = ['Engagement','Culture','Leadership','Onboarding','Compensation','Wellbeing','DEI'];
  readonly categoryOptions = this.categories.map(c => ({ label: c, value: c }));

  responseRate(s: Survey) { return s.total > 0 ? Math.round((s.responses / s.total) * 100) : 0; }

  createSurvey() {
    if (!this.newTitle().trim()) return;
    this.creating.set(true);
    setTimeout(() => {
      this._surveys.update(list => [{
        id: Date.now().toString(),
        title: this.newTitle(),
        description: this.newDesc(),
        status: 'draft',
        questions: 0,
        responses: 0,
        total: 20,
        dueDate: this.newDue(),
        avgScore: null,
        category: this.newCategory(),
      }, ...list]);
      this.creating.set(false);
      this.created.set(true);
      this.newTitle.set(''); this.newDesc.set(''); this.newDue.set('');
      setTimeout(() => { this.created.set(false); this.activeTab.set('surveys'); }, 1500);
    }, 800);
  }

  readonly eNPS = signal(42); // –100 to +100
  readonly engagementDrivers = [
    { label: 'Work-Life Balance',    score: 3.8 },
    { label: 'Growth Opportunities', score: 4.0 },
    { label: 'Manager Support',      score: 4.2 },
    { label: 'Recognition',          score: 3.5 },
    { label: 'Team Culture',         score: 4.4 },
  ];
}
