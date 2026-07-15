import { Routes } from '@angular/router';

export const compensationRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/compensation-hub/compensation-hub.component').then(m => m.CompensationHubComponent),
  },
  {
    path: 'employee/:id',
    loadComponent: () =>
      import('./pages/employee-salary/employee-salary.component').then(m => m.EmployeeSalaryComponent),
  },
];
