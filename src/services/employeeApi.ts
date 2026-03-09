import { request } from './http';

export interface Employee {
  id: string;
  fullName: string;
  cpf: string;
  rg?: string;
  birthDate?: string;
  motherName?: string;
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  phone?: string;
  email?: string;
  employeeCode?: string;
  admissionDate?: string;
  ctps?: string;
  pis?: string;
  position: string;
  department: 'centro_educacional' | 'recreacao_infantil' | string;
  contractType?: 'CLT' | 'temporary' | 'intern';
  status: 'active' | 'inactive' | 'pending_approval' | 'dismissed';
  salaryType: 'hourly' | 'monthly';
  baseSalary?: number;
  hourlyRate?: number;
  weeklyHours?: number;
  teachingData?: {
    subjects: string[];
    levels: {
      infantil: number;
      fundamental1: number;
      fundamental2: number;
      medio: number;
      ro: number;
    };
    hourlyRates: {
      infantil: number;
      fundamental1: number;
      fundamental2: number;
      medio: number;
    };
  };
  bankData?: {
    bank: string;
    agency: string;
    account: string;
    accountType: 'corrente' | 'poupanca';
    pixKey?: string;
  };
  benefits?: {
    transportVoucher: {
      enabled: boolean;
      routes: string[];
      workDays: number;
      monthlyValue?: number;
    };
    mealVoucher: {
      enabled: boolean;
      workDays: number;
      monthlyValue?: number;
    };
  };
  payrollData?: {
    inssBase: number;
    irrfBase: number;
    dependents: number;
    unionFee: boolean;
    transportDeduction: number;
    mealDeduction: number;
  };
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface PayrollCalculation {
  employee: Employee;
  period: { month: number; year: number };
  calculation: {
    workDays: number;
    absences: number;
    classesGiven?: {
      infantil: number;
      fundamental1: number;
      fundamental2: number;
      medio: number;
      ro: number;
    };
    baseSalary: number;
    dsr: number;
    hourActivity: number;
    grossEarnings: number;
    inssCalculation: {
      base: number;
      rate: number;
      value: number;
    };
    irrfCalculation: {
      base: number;
      rate: number;
      deduction: number;
      value: number;
    };
    benefitDeductions: {
      transport: number;
      meal: number;
    };
    totalDeductions: number;
    netSalary: number;
    fgts: number;
  };
}

const mapEmployee = (apiEmployee: any): Employee => {
  const addressLine = apiEmployee.addressLine || '';
  const [streetPart, numberPart] = addressLine.split(',').map((value: string) => value.trim());

  return {
    id: apiEmployee.id,
    fullName: apiEmployee.fullName,
    cpf: apiEmployee.cpf,
    rg: apiEmployee.rg || undefined,
    birthDate: apiEmployee.birthDate || undefined,
    motherName: apiEmployee.motherName || undefined,
    address: apiEmployee.addressLine
      ? {
          street: streetPart || '',
          number: numberPart || '',
          complement: undefined,
          neighborhood: '',
          city: apiEmployee.city || '',
          state: apiEmployee.state || '',
          zipCode: apiEmployee.zipCode || ''
        }
      : undefined,
    phone: apiEmployee.phone || undefined,
    email: apiEmployee.email || undefined,
    employeeCode: apiEmployee.employeeCode || undefined,
    admissionDate: apiEmployee.admissionDate || undefined,
    ctps: apiEmployee.ctps || undefined,
    pis: apiEmployee.pis || undefined,
    position: apiEmployee.position,
    department: apiEmployee.department,
    status: apiEmployee.status,
    salaryType: apiEmployee.salaryType,
    baseSalary: apiEmployee.baseSalary ? Number(apiEmployee.baseSalary) : undefined,
    hourlyRate: apiEmployee.hourlyRate ? Number(apiEmployee.hourlyRate) : undefined,
    weeklyHours: apiEmployee.weeklyHours ? Number(apiEmployee.weeklyHours) : undefined,
    benefits: {
      transportVoucher: {
        enabled: Boolean(apiEmployee.transportVoucherValue),
        routes: [],
        workDays: 22,
        monthlyValue: apiEmployee.transportVoucherValue ? Number(apiEmployee.transportVoucherValue) : undefined
      },
      mealVoucher: {
        enabled: Boolean(apiEmployee.mealVoucherValue),
        workDays: 22,
        monthlyValue: apiEmployee.mealVoucherValue ? Number(apiEmployee.mealVoucherValue) : undefined
      }
    },
    payrollData: {
      inssBase: 0,
      irrfBase: 0,
      dependents: apiEmployee.dependents ?? 0,
      unionFee: apiEmployee.unionFee ?? false,
      transportDeduction: 0,
      mealDeduction: 0
    },
    createdAt: apiEmployee.createdAt || undefined,
    updatedAt: apiEmployee.updatedAt || undefined
  };
};

export const employeeApi = {
  async getEmployees(filters?: {
    status?: string;
    department?: string;
    position?: string;
  }): Promise<Employee[]> {
    const query = new URLSearchParams();
    if (filters?.status) query.set('status', filters.status);
    if (filters?.department) query.set('department', filters.department);
    if (filters?.position) query.set('position', filters.position);

    const data = await request<any[]>(`/employees?${query.toString()}`);
    return data.map(mapEmployee);
  },

  async getPendingEmployees(): Promise<Employee[]> {
    const data = await request<any[]>('/employees/pending');
    return data.map(mapEmployee);
  },

  async getEmployee(id: string): Promise<Employee | null> {
    const data = await request<any>(`/employees/${id}`);
    return data ? mapEmployee(data) : null;
  },

  async getEmployeeByCPF(cpf: string): Promise<Employee | null> {
    const employees = await this.getEmployees();
    return employees.find((employee) => employee.cpf === cpf) || null;
  },

  async createEmployee(employeeData: Omit<Employee, 'id'>): Promise<Employee> {
    const data = await request<any>('/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData)
    });
    return mapEmployee(data);
  },

  async approveEmployee(id: string): Promise<Employee> {
    const data = await request<any>(`/employees/${id}/approve`, { method: 'POST' });
    return mapEmployee(data);
  },

  async rejectEmployee(id: string, reason: string): Promise<void> {
    await request<void>(`/employees/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async calculateSalary(employeeId: string, month: number, year: number): Promise<PayrollCalculation> {
    const calculation = await request<any>('/payroll/preview', {
      method: 'POST',
      body: JSON.stringify({ employeeId, month, year })
    });

    const employee = await this.getEmployee(employeeId);
    if (!employee) {
      throw new Error('Funcionario nao encontrado');
    }

    return {
      employee,
      period: { month, year },
      calculation: {
        workDays: 22,
        absences: 0,
        baseSalary: calculation.earnings.find((item: any) => item.code === 'BASE')?.amount ?? 0,
        dsr: calculation.earnings.find((item: any) => item.code === 'DSR')?.amount ?? 0,
        hourActivity: calculation.earnings.find((item: any) => item.code === 'HORA_ATV')?.amount ?? 0,
        grossEarnings: calculation.grossSalary,
        inssCalculation: {
          base: calculation.grossSalary,
          rate: 0,
          value: calculation.deductions.find((item: any) => item.code === 'INSS')?.amount ?? 0
        },
        irrfCalculation: {
          base: calculation.grossSalary,
          rate: 0,
          deduction: 0,
          value: calculation.deductions.find((item: any) => item.code === 'IRRF')?.amount ?? 0
        },
        benefitDeductions: {
          transport: calculation.deductions.find((item: any) => item.code === 'VT')?.amount ?? 0,
          meal: calculation.deductions.find((item: any) => item.code === 'VA')?.amount ?? 0
        },
        totalDeductions: calculation.totalDeductions,
        netSalary: calculation.netSalary,
        fgts: calculation.fgts
      }
    };
  }
};