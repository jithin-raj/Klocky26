export type EmployeeRole   = 'admin' | 'hr' | 'manager' | 'employee';
export type EmployeeStatus = 'active' | 'inactive' | 'on_leave';

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  get fullName(): string;
  email: string;
  phone: string;
  role: EmployeeRole;
  department: string;
  designation: string;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  officeLocation: string;
  dateOfJoining: string;     // ISO date YYYY-MM-DD
  avatarUrl: string | null;
  initials: string;
  avatarColor: string;       // hex
  isActive: boolean;
  status: EmployeeStatus;
}

// Plain object form used in components (no getter)
export interface EmployeeRow {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  role: EmployeeRole;
  /** Org/hierarchy role name (e.g. CEO, Manager) — shown in the grid instead of the system role. */
  orgRoleName?: string | null;
  /** Employment type (full_time, part_time, permanent, contract, intern). */
  employmentType?: string | null;
  department: string;
  designation: string;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  officeLocation: string;
  dateOfJoining: string;
  avatarUrl: string | null;
  initials: string;
  avatarColor: string;
  isActive: boolean;
  status: EmployeeStatus;
  /** Identity flag (spec §3/§7) — render a "Guest" badge when true. */
  isGuest?: boolean;
  /** Payroll figures — null unless the caller is admin/HR (spec §3). */
  basicSalary?: number | null;
  allowances?: number | null;
  otherDeductions?: number | null;
}

export const DEPARTMENTS = [
  'Engineering', 'Design', 'Marketing', 'Sales',
  'Operations', 'Finance', 'HR', 'Product', 'Legal',
];

export const DESIGNATIONS: Record<string, string[]> = {
  Engineering: ['Software Engineer', 'Senior Engineer', 'Tech Lead', 'Engineering Manager', 'CTO'],
  Design:      ['UI Designer', 'UX Designer', 'Product Designer', 'Design Lead'],
  Marketing:   ['Marketing Executive', 'Content Writer', 'SEO Specialist', 'Marketing Manager'],
  Sales:       ['Sales Executive', 'Business Development', 'Account Manager', 'Sales Manager'],
  Operations:  ['Operations Executive', 'Operations Manager', 'Business Analyst'],
  Finance:     ['Accountant', 'Finance Analyst', 'Finance Manager', 'CFO'],
  HR:          ['HR Executive', 'HR Manager', 'Talent Acquisition', 'CHRO'],
  Product:     ['Product Manager', 'Product Analyst', 'CPO'],
  Legal:       ['Legal Counsel', 'Compliance Officer'],
};

const AVATAR_COLORS = [
  '#6366f1','#ec4899','#f59e0b','#22c55e','#14b8a6','#8b5cf6','#ef4444','#0ea5e9',
];

let _seq = 1;
function uid() { return String(_seq++).padStart(3, '0'); }

function mkInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function mkRow(
  id: string, code: string, first: string, last: string, email: string, phone: string,
  role: EmployeeRole, dept: string, desig: string,
  mgrId: string | null, mgrName: string | null, office: string, joined: string,
  status: EmployeeStatus, colorIdx: number,
): EmployeeRow {
  return {
    id, employeeCode: code, firstName: first, lastName: last,
    fullName: `${first} ${last}`, email, phone, role, department: dept,
    designation: desig, reportingManagerId: mgrId, reportingManagerName: mgrName,
    officeLocation: office, dateOfJoining: joined,
    avatarUrl: null,
    initials: mkInitials(first, last),
    avatarColor: AVATAR_COLORS[colorIdx % AVATAR_COLORS.length],
    isActive: status === 'active' || status === 'on_leave',
    status,
  };
}

export const MOCK_EMPLOYEES: EmployeeRow[] = [
  mkRow('1','EMP001','Riya',    'Sharma',   'riya.sharma@acme.com',    '+91 98765 43210','admin',   'HR',          'HR Manager',        null, null,               'Mumbai HQ',    '2021-03-15','active',  0),
  mkRow('2','EMP002','Arjun',   'Mehta',    'arjun.mehta@acme.com',    '+91 98765 43211','manager', 'Engineering', 'Engineering Manager','1',  'Riya Sharma',      'Mumbai HQ',    '2020-07-01','active',  1),
  mkRow('3','EMP003','Priya',   'Nair',     'priya.nair@acme.com',     '+91 98765 43212','hr',      'HR',          'HR Executive',      '1',  'Riya Sharma',      'Mumbai HQ',    '2022-01-10','active',  2),
  mkRow('4','EMP004','Rohan',   'Desai',    'rohan.desai@acme.com',    '+91 98765 43213','employee','Engineering', 'Senior Engineer',   '1',  'Arjun Mehta',      'Bangalore',    '2021-09-20','active',  3),
  mkRow('5','EMP005','Sneha',   'Kapoor',   'sneha.kapoor@acme.com',   '+91 98765 43214','employee','Design',      'UI Designer',       '2',  'Arjun Mehta',      'Mumbai HQ',    '2022-06-05','active',  4),
  mkRow('6','EMP006','Vivek',   'Sharma',   'vivek.sharma@acme.com',   '+91 98765 43215','manager', 'Sales',       'Sales Manager',     '1',  'Riya Sharma',      'Delhi',        '2020-11-12','active',  5),
  mkRow('7','EMP007','Kavya',   'Iyer',     'kavya.iyer@acme.com',     '+91 98765 43216','employee','Design',      'UX Designer',       '5',  'Sneha Kapoor',     'Mumbai HQ',    '2023-04-18','active',  6),
  mkRow('8','EMP008','Rahul',   'Tiwari',   'rahul.tiwari@acme.com',   '+91 98765 43217','employee','Marketing',   'Marketing Executive','6', 'Vivek Sharma',     'Delhi',        '2021-05-30','inactive',7),
  mkRow('9','EMP009','Meera',   'Joshi',    'meera.joshi@acme.com',    '+91 98765 43218','employee','Finance',     'Finance Analyst',   '1',  'Riya Sharma',      'Mumbai HQ',    '2022-09-14','active',  0),
  mkRow('10','EMP010','Siddharth','Rao',    'siddharth.rao@acme.com',  '+91 98765 43219','employee','Engineering', 'Software Engineer', '2',  'Arjun Mehta',      'Bangalore',    '2023-01-25','active',  1),
  mkRow('11','EMP011','Ananya',  'Singh',   'ananya.singh@acme.com',   '+91 98765 43220','employee','Marketing',   'Content Writer',    '6',  'Vivek Sharma',     'Delhi',        '2022-08-08','active',  2),
  mkRow('12','EMP012','Kartik',  'Patel',   'kartik.patel@acme.com',   '+91 98765 43221','employee','Engineering', 'Tech Lead',         '2',  'Arjun Mehta',      'Bangalore',    '2019-12-01','active',  3),
  mkRow('13','EMP013','Divya',   'Kumar',   'divya.kumar@acme.com',    '+91 98765 43222','employee','HR',          'Talent Acquisition','3',  'Priya Nair',       'Mumbai HQ',    '2023-03-15','on_leave',4),
  mkRow('14','EMP014','Aman',    'Gupta',   'aman.gupta@acme.com',     '+91 98765 43223','employee','Sales',       'Sales Executive',   '6',  'Vivek Sharma',     'Delhi',        '2022-11-28','active',  5),
  mkRow('15','EMP015','Pooja',   'Verma',   'pooja.verma@acme.com',    '+91 98765 43224','employee','Operations',  'Operations Manager','1',  'Riya Sharma',      'Mumbai HQ',    '2020-04-22','active',  6),
  mkRow('16','EMP016','Nikhil',  'Bansal',  'nikhil.bansal@acme.com',  '+91 98765 43225','employee','Finance',     'Accountant',        '9',  'Meera Joshi',      'Mumbai HQ',    '2023-07-03','active',  7),
  mkRow('17','EMP017','Sakshi',  'Mishra',  'sakshi.mishra@acme.com',  '+91 98765 43226','employee','Engineering', 'Software Engineer', '2',  'Arjun Mehta',      'Bangalore',    '2024-01-15','active',  0),
  mkRow('18','EMP018','Tarun',   'Reddy',   'tarun.reddy@acme.com',    '+91 98765 43227','employee','Design',      'Product Designer',  '5',  'Sneha Kapoor',     'Hyderabad',    '2023-10-10','active',  1),
  mkRow('19','EMP019','Ishita',  'Shah',    'ishita.shah@acme.com',    '+91 98765 43228','hr',      'HR',          'HR Executive',      '3',  'Priya Nair',       'Mumbai HQ',    '2022-05-19','active',  2),
  mkRow('20','EMP020','Rajeev',  'Nair',    'rajeev.nair@acme.com',    '+91 98765 43229','employee','Engineering', 'Senior Engineer',   '12', 'Kartik Patel',     'Bangalore',    '2021-08-25','active',  3),
];
