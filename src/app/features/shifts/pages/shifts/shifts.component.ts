import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MOCK_EMPLOYEES } from '../../../employees/models/employee.model';
import { OrgTimeStringPipe } from '../../../../shared/pipes/localization.pipes';

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  daysOfWeek: number[]; // 0=Sun, 6=Sat
}

interface RosterEntry {
  employeeId: string;
  date: string; // YYYY-MM-DD
  shiftId: string;
}

const SHIFTS: Shift[] = [
  { id:'S1', name:'Morning',   startTime:'07:00', endTime:'15:00', color:'#22c55e', daysOfWeek:[1,2,3,4,5] },
  { id:'S2', name:'General',   startTime:'09:00', endTime:'18:00', color:'#6366f1', daysOfWeek:[1,2,3,4,5] },
  { id:'S3', name:'Evening',   startTime:'14:00', endTime:'22:00', color:'#f59e0b', daysOfWeek:[1,2,3,4,5] },
  { id:'S4', name:'Night',     startTime:'22:00', endTime:'06:00', color:'#8b5cf6', daysOfWeek:[1,2,3,4,5,6,0] },
  { id:'S5', name:'Weekend',   startTime:'10:00', endTime:'16:00', color:'#ec4899', daysOfWeek:[6,0] },
];

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Generate week dates starting Monday
function getWeekDates(base: Date): Date[] {
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

@Component({
  selector: 'app-shifts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, OrgTimeStringPipe],
  templateUrl: './shifts.component.html',
  styleUrl: './shifts.component.scss',
})
export class ShiftsComponent {

  readonly shifts = SHIFTS;
  readonly dayNames = DAY_NAMES;

  baseDate = signal(new Date(2026, 3, 27)); // Monday Apr 27 2026
  activeTab = signal<'roster' | 'shifts'>('roster');
  selectedShift = signal<string>('S2');

  weekDates = computed(() => getWeekDates(this.baseDate()));

  private _roster = signal<RosterEntry[]>([
    // Seed some roster entries
    ...MOCK_EMPLOYEES.slice(0, 8).flatMap((emp, i) =>
      getWeekDates(new Date(2026, 3, 27)).map((d, di) => ({
        employeeId: emp.id,
        date: d.toISOString().split('T')[0],
        shiftId: di < 5 ? SHIFTS[i % 3].id : '',
      })).filter(r => r.shiftId)
    ),
  ]);

  getShift(empId: string, date: Date): Shift | null {
    const ds = date.toISOString().split('T')[0];
    const entry = this._roster().find(r => r.employeeId === empId && r.date === ds);
    return entry ? SHIFTS.find(s => s.id === entry.shiftId) ?? null : null;
  }

  assignShift(empId: string, date: Date, shiftId: string) {
    const ds = date.toISOString().split('T')[0];
    this._roster.update(list => {
      const existing = list.findIndex(r => r.employeeId === empId && r.date === ds);
      if (shiftId === '') {
        return list.filter((_, i) => i !== existing);
      }
      if (existing >= 0) {
        const copy = [...list];
        copy[existing] = { ...copy[existing], shiftId };
        return copy;
      }
      return [...list, { employeeId: empId, date: ds, shiftId }];
    });
  }

  prevWeek() {
    const d = new Date(this.baseDate());
    d.setDate(d.getDate() - 7);
    this.baseDate.set(d);
  }

  nextWeek() {
    const d = new Date(this.baseDate());
    d.setDate(d.getDate() + 7);
    this.baseDate.set(d);
  }

  readonly employees = MOCK_EMPLOYEES.slice(0, 10);

  weekLabel = computed(() => {
    const w = this.weekDates();
    return `${w[0].toLocaleDateString('en',{ month:'short', day:'numeric' })} – ${w[6].toLocaleDateString('en',{ month:'short', day:'numeric', year:'numeric' })}`;
  });
}
