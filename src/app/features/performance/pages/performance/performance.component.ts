import {
  Component, ChangeDetectionStrategy, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MOCK_EMPLOYEES } from '../../../employees/models/employee.model';
import { UiSelectComponent } from '../../../../shared/components';

interface Review {
  id: string;
  employeeId: string;
  employeeName: string;
  initials: string;
  avatarColor: string;
  department: string;
  period: string;
  rating: number;        // 1-5
  goals: number;
  goalsCompleted: number;
  status: 'pending' | 'in_progress' | 'completed';
  reviewer: string;
}

interface Goal {
  id: string;
  employeeName: string;
  initials: string;
  avatarColor: string;
  title: string;
  target: string;
  progress: number;
  due: string;
  status: 'on_track' | 'at_risk' | 'behind' | 'completed';
}

const REVIEWS: Review[] = [
  { id:'1', employeeId:'2', employeeName:'Arjun Mehta',    initials:'AM', avatarColor:'#ec4899', department:'Engineering',  period:'Q1 2026', rating:4.2, goals:6, goalsCompleted:5, status:'completed', reviewer:'Riya Sharma' },
  { id:'2', employeeId:'4', employeeName:'Rohan Desai',    initials:'RD', avatarColor:'#22c55e', department:'Engineering',  period:'Q1 2026', rating:4.5, goals:4, goalsCompleted:4, status:'completed', reviewer:'Arjun Mehta' },
  { id:'3', employeeId:'5', employeeName:'Sneha Kapoor',   initials:'SK', avatarColor:'#14b8a6', department:'Design',       period:'Q1 2026', rating:3.8, goals:5, goalsCompleted:3, status:'completed', reviewer:'Arjun Mehta' },
  { id:'4', employeeId:'6', employeeName:'Vivek Sharma',   initials:'VS', avatarColor:'#8b5cf6', department:'Sales',        period:'Q2 2026', rating:0,   goals:5, goalsCompleted:0, status:'in_progress', reviewer:'Riya Sharma' },
  { id:'5', employeeId:'9', employeeName:'Meera Joshi',    initials:'MJ', avatarColor:'#6366f1', department:'Finance',      period:'Q2 2026', rating:0,   goals:4, goalsCompleted:0, status:'pending',    reviewer:'Riya Sharma' },
  { id:'6', employeeId:'12',employeeName:'Kartik Patel',   initials:'KP', avatarColor:'#22c55e', department:'Engineering',  period:'Q2 2026', rating:0,   goals:6, goalsCompleted:1, status:'in_progress', reviewer:'Arjun Mehta' },
];

const GOALS: Goal[] = [
  { id:'1', employeeName:'Arjun Mehta',   initials:'AM', avatarColor:'#ec4899', title:'Ship v2 API',                  target:'Deploy by May 31',         progress:65, due:'2026-05-31', status:'on_track' },
  { id:'2', employeeName:'Sneha Kapoor',  initials:'SK', avatarColor:'#14b8a6', title:'Design system audit',          target:'Review all 40 components', progress:30, due:'2026-05-15', status:'at_risk' },
  { id:'3', employeeName:'Vivek Sharma',  initials:'VS', avatarColor:'#8b5cf6', title:'Q2 revenue target',            target:'₹40L new ARR',             progress:55, due:'2026-06-30', status:'on_track' },
  { id:'4', employeeName:'Meera Joshi',   initials:'MJ', avatarColor:'#6366f1', title:'Automate payroll reports',     target:'Reduce manual effort 80%', progress:10, due:'2026-05-10', status:'behind' },
  { id:'5', employeeName:'Kartik Patel',  initials:'KP', avatarColor:'#22c55e', title:'Code review process',          target:'100% PRs reviewed',        progress:100,due:'2026-04-30', status:'completed' },
  { id:'6', employeeName:'Rohan Desai',   initials:'RD', avatarColor:'#22c55e', title:'Performance optimisation',     target:'Reduce API p95 to <200ms', progress:88, due:'2026-05-20', status:'on_track' },
];

@Component({
  selector: 'app-performance',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent],
  templateUrl: './performance.component.html',
  styleUrl: './performance.component.scss',
})
export class PerformanceComponent {
  activeTab = signal<'reviews' | 'goals' | 'kpis'>('reviews');
  filterStatus = signal('');

  readonly reviewStatusOptions = [
    { label: 'All Status', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Completed', value: 'completed' },
  ];
  readonly goalStatusOptions = [
    { label: 'All Status', value: '' },
    { label: 'On Track', value: 'on_track' },
    { label: 'At Risk', value: 'at_risk' },
    { label: 'Behind', value: 'behind' },
    { label: 'Completed', value: 'completed' },
  ];
  readonly filterStatusOptions = computed(() =>
    this.activeTab() === 'reviews' ? this.reviewStatusOptions : this.goalStatusOptions
  );

  readonly reviews = REVIEWS;
  readonly goals   = GOALS;

  readonly filteredReviews = computed(() => {
    const s = this.filterStatus();
    return s ? this.reviews.filter(r => r.status === s) : this.reviews;
  });

  readonly filteredGoals = computed(() => {
    const s = this.filterStatus();
    return s ? this.goals.filter(g => g.status === s) : this.goals;
  });

  readonly avgRating = computed(() => {
    const rated = this.reviews.filter(r => r.rating > 0);
    return rated.length ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1) : '–';
  });

  readonly completionRate = computed(() => {
    const done = this.reviews.filter(r => r.status === 'completed').length;
    return Math.round((done / this.reviews.length) * 100);
  });

  stars(rating: number) { return Array.from({ length: 5 }, (_, i) => i + 1 <= Math.round(rating)); }

  readonly kpis = [
    { label: 'Avg Rating',          value: () => this.avgRating(),              unit: '/ 5.0', trend: '+0.3',  up: true },
    { label: 'Reviews Completed',   value: () => `${this.completionRate()}%`,   unit: '',      trend: '+12%',  up: true },
    { label: 'Goals On Track',      value: () => `${GOALS.filter(g => g.status === 'on_track').length}`,  unit: `/ ${GOALS.length}`, trend: '',  up: true },
    { label: 'At Risk Goals',       value: () => `${GOALS.filter(g => g.status === 'at_risk' || g.status === 'behind').length}`, unit: '', trend: '-2',  up: false },
  ];
}
