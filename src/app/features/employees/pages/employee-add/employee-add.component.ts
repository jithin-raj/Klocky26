import {
  Component, ChangeDetectionStrategy, signal, OnInit, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MOCK_EMPLOYEES, DEPARTMENTS, DESIGNATIONS } from '../../models/employee.model';
import { OrgNavigationService } from '../../../../core/services/org-navigation.service';

interface EmployeeForm {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  designation: string;
  reportingManagerId: string;
  officeLocation: string;
  dateOfJoining: string;
  status: string;
}

@Component({
  selector: 'app-employee-add',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-add.component.html',
  styleUrl: './employee-add.component.scss',
})
export class EmployeeAddComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private orgNav = inject(OrgNavigationService);

  isEdit   = signal(false);
  empId    = signal<string | null>(null);
  loading  = signal(false);
  saved    = signal(false);
  errors   = signal<Record<string, string>>({});

  readonly departments  = DEPARTMENTS;
  readonly designations = DESIGNATIONS;
  readonly roles        = ['admin', 'hr', 'manager', 'employee'];
  readonly offices      = ['Mumbai HQ', 'Bangalore', 'Delhi', 'Hyderabad', 'Pune'];

  readonly managers = MOCK_EMPLOYEES.filter(e =>
    e.role === 'admin' || e.role === 'manager' || e.role === 'hr'
  );

  form = signal<EmployeeForm>({
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'employee',
    department: '',
    designation: '',
    reportingManagerId: '',
    officeLocation: 'Mumbai HQ',
    dateOfJoining: new Date().toISOString().split('T')[0],
    status: 'active',
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.empId.set(id);
      const emp = MOCK_EMPLOYEES.find(e => e.id === id);
      if (emp) {
        this.form.set({
          employeeCode: emp.employeeCode,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          phone: emp.phone,
          role: emp.role,
          department: emp.department,
          designation: emp.designation,
          reportingManagerId: emp.reportingManagerId ?? '',
          officeLocation: emp.officeLocation,
          dateOfJoining: emp.dateOfJoining,
          status: emp.status,
        });
      }
    } else {
      // Auto-generate code
      const next = MOCK_EMPLOYEES.length + 1;
      this.form.update(f => ({ ...f, employeeCode: `EMP${String(next).padStart(3,'0')}` }));
    }
  }

  get availableDesignations(): string[] {
    return this.designations[this.form().department] ?? [];
  }

  patch(field: keyof EmployeeForm, value: string) {
    this.form.update(f => ({ ...f, [field]: value }));
    if (field === 'department') {
      this.form.update(f => ({ ...f, designation: '' }));
    }
    // clear error
    const errs = { ...this.errors() };
    delete errs[field];
    this.errors.set(errs);
  }

  validate(): boolean {
    const f = this.form();
    const errs: Record<string, string> = {};
    if (!f.firstName.trim())   errs['firstName']   = 'First name is required';
    if (!f.lastName.trim())    errs['lastName']     = 'Last name is required';
    if (!f.email.trim())       errs['email']        = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errs['email'] = 'Invalid email address';
    if (!f.department)         errs['department']   = 'Department is required';
    if (!f.designation)        errs['designation']  = 'Designation is required';
    if (!f.dateOfJoining)      errs['dateOfJoining'] = 'Join date is required';
    this.errors.set(errs);
    return Object.keys(errs).length === 0;
  }

  submit() {
    if (!this.validate()) return;
    this.loading.set(true);
    // Simulate API call
    setTimeout(() => {
      this.loading.set(false);
      this.saved.set(true);
      setTimeout(() => this.orgNav.navigate(['app', 'employees']), 1200);
    }, 800);
  }

  cancel() { this.orgNav.navigate(['app', 'employees']); }
}
