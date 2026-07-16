import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiSelectComponent } from '../../../../shared/components';
import { OrgDateOnlyPipe } from '../../../../shared/pipes/localization.pipes';

type CandidateStage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';

interface Job {
  id: string; title: string; department: string; type: string;
  location: string; openedDate: string; applicants: number; status: 'open' | 'closed';
}
interface Candidate {
  id: string; jobId: string; name: string; email: string;
  stage: CandidateStage; appliedDate: string; initials: string; color: string; experience: string;
}

const JOBS: Job[] = [
  { id:'1', title:'Senior Software Engineer', department:'Engineering', type:'Full-time', location:'Bangalore',  openedDate:'2026-04-01', applicants:18, status:'open' },
  { id:'2', title:'Product Designer',         department:'Design',       type:'Full-time', location:'Mumbai HQ', openedDate:'2026-04-10', applicants:9,  status:'open' },
  { id:'3', title:'Sales Executive',          department:'Sales',        type:'Full-time', location:'Delhi',     openedDate:'2026-03-20', applicants:24, status:'open' },
  { id:'4', title:'HR Specialist',            department:'HR',           type:'Full-time', location:'Mumbai HQ', openedDate:'2026-02-15', applicants:11, status:'closed' },
];

const CANDIDATES: Candidate[] = [
  { id:'1', jobId:'1', name:'Ankit Sharma',    email:'ankit@mail.com',    stage:'interview', appliedDate:'2026-04-05', initials:'AS', color:'#6366f1', experience:'5 years' },
  { id:'2', jobId:'1', name:'Prashant Reddy',  email:'prashant@mail.com', stage:'screening', appliedDate:'2026-04-08', initials:'PR', color:'#22c55e', experience:'4 years' },
  { id:'3', jobId:'1', name:'Neha Bhatia',     email:'neha@mail.com',     stage:'offer',     appliedDate:'2026-04-03', initials:'NB', color:'#ec4899', experience:'7 years' },
  { id:'4', jobId:'2', name:'Ritik Malhotra',  email:'ritik@mail.com',    stage:'applied',   appliedDate:'2026-04-12', initials:'RM', color:'#f59e0b', experience:'3 years' },
  { id:'5', jobId:'2', name:'Shreya Patel',    email:'shreya@mail.com',   stage:'screening', appliedDate:'2026-04-11', initials:'SP', color:'#8b5cf6', experience:'4 years' },
  { id:'6', jobId:'3', name:'Karan Mishra',    email:'karan@mail.com',    stage:'hired',     appliedDate:'2026-03-25', initials:'KM', color:'#14b8a6', experience:'2 years' },
  { id:'7', jobId:'1', name:'Divya Krishnan',  email:'divya@mail.com',    stage:'rejected',  appliedDate:'2026-04-06', initials:'DK', color:'#ef4444', experience:'1 year'  },
];

@Component({
  selector: 'app-recruitment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UiSelectComponent, OrgDateOnlyPipe],
  templateUrl: './recruitment.component.html',
  styleUrl: './recruitment.component.scss',
})
export class RecruitmentComponent {
  activeTab    = signal<'pipeline' | 'jobs' | 'onboarding'>('pipeline');
  selectedJob  = signal<string>('');

  readonly jobs       = JOBS;
  readonly jobOptions = [
    { label: 'All Jobs', value: '' },
    ...JOBS.map(j => ({ label: j.title, value: j.id })),
  ];
  readonly stages: CandidateStage[] = ['applied','screening','interview','offer','hired','rejected'];
  readonly stageLabel: Record<CandidateStage, string> = {
    applied:'Applied', screening:'Screening', interview:'Interview',
    offer:'Offer', hired:'Hired', rejected:'Rejected',
  };

  private _candidates = signal<Candidate[]>(CANDIDATES);

  candidatesForJob = computed(() => {
    const jid = this.selectedJob();
    return jid ? this._candidates().filter(c => c.jobId === jid) : this._candidates();
  });

  candidatesByStage(stage: CandidateStage) {
    return computed(() => this.candidatesForJob().filter(c => c.stage === stage));
  }

  moveStage(id: string, stage: CandidateStage) {
    this._candidates.update(list => list.map(c => c.id === id ? { ...c, stage } : c));
  }

  readonly onboardingChecklist = [
    { task: 'Send offer letter',              done: true  },
    { task: 'Background verification',        done: true  },
    { task: 'System access provisioning',     done: false },
    { task: 'Equipment allocation',           done: false },
    { task: 'Day 1 schedule sent',            done: false },
    { task: 'Buddy/mentor assigned',          done: false },
    { task: '30-day goal setting',            done: false },
  ];

  readonly stageColor: Record<CandidateStage, string> = {
    applied: '#94a3b8', screening: '#6366f1', interview: '#f59e0b',
    offer: '#22c55e', hired: '#16a34a', rejected: '#ef4444',
  };

  get onboardingDoneCount(): number {
    return this.onboardingChecklist.filter(t => t.done).length;
  }
}
