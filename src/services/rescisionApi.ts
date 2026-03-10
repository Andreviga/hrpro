/**
 * API para cálculos de rescisão trabalhista
 * Baseado na CCT Sinprosp 2024/2025 e legislação trabalhista
 */
import { employeeApi } from './employeeApi';

export interface Employee {
  id: string;
  name: string;
  cpf: string;
  rg: string;
  birthDate: string;
  motherName: string;
  admissionDate: string;
  position: string;
  ctps: string;
  pis: string;
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  bankData: {
    bank: string;
    agency: string;
    account: string;
    accountType: 'corrente' | 'poupanca';
    pixKey?: string;
  };
  salary: {
    type: 'hourly' | 'monthly';
    value: number;
    weeklyHours?: number;
  };
}

export interface RescisionItem {
  code: string;
  description: string;
  value: number;
  type: 'earning' | 'deduction';
  calculation?: string;
}

export interface RescisionCalculation {
  employee: Employee;
  rescisionType: string;
  rescisionDate: string;
  priorNoticeType: string;
  hasVacationDue: boolean;
  calculation: {
    workingDays: number;
    monthsWorked: number;
    items: RescisionItem[];
    totalGross: number;
    totalDeductions: number;
    netValue: number;
    fgtsDeposit: number;
    fgtsFine: number;
    grossSalary: number;
  };
}

export const rescisionApi = {
  /**
   * Busca funcionário por CPF via API de funcionários
   */
  async searchEmployeeByCPF(cpf: string): Promise<Employee | null> {
    const normalizedCpf = cpf.replace(/\D/g, '');
    const emp = await employeeApi.getEmployeeByCPF(normalizedCpf);
    if (!emp) return null;
    const ctpsFormatted = emp.ctpsNumber
      ? `${emp.ctpsNumber}-${emp.ctpsSeries ?? ''}/${emp.ctpsState ?? ''}`
      : (emp.ctps ?? '');
    return {
      id: emp.id,
      name: emp.fullName,
      cpf: emp.cpf,
      rg: emp.rg ?? '',
      birthDate: emp.birthDate ?? '',
      motherName: emp.motherName ?? '',
      admissionDate: emp.admissionDate ?? '',
      position: emp.position,
      ctps: ctpsFormatted,
      pis: emp.pis ?? '',
      address: {
        street: emp.address?.street ?? '',
        number: emp.address?.number ?? '',
        complement: emp.address?.complement,
        neighborhood: emp.address?.neighborhood ?? '',
        city: emp.address?.city ?? '',
        state: emp.address?.state ?? '',
        zipCode: emp.address?.zipCode ?? ''
      },
      bankData: emp.bankData
        ? {
            bank: emp.bankData.bank,
            agency: emp.bankData.agency,
            account: emp.bankData.account,
            accountType: emp.bankData.accountType,
            pixKey: emp.bankData.pixKey
          }
        : { bank: '', agency: '', account: '', accountType: 'corrente' },
      salary:
        emp.salaryType === 'hourly'
          ? { type: 'hourly', value: emp.hourlyRate ?? 0, weeklyHours: emp.weeklyHours }
          : { type: 'monthly', value: emp.baseSalary ?? 0 }
    };
  },

  /**
   * Calcula rescisão trabalhista
   */
  async calculateRescision(data: {
    employee: Employee;
    rescisionType: string;
    rescisionDate: string;
    priorNoticeType: string;
    hasVacationDue: boolean;
  }): Promise<RescisionCalculation> {
    await new Promise(resolve => setTimeout(resolve, 800));

    const { employee, rescisionType, rescisionDate, priorNoticeType, hasVacationDue } = data;
    
    // Calcular tempo de serviço
    const admissionDate = new Date(employee.admissionDate);
    const rescDate = new Date(rescisionDate);
    const yearsWorked = rescDate.getFullYear() - admissionDate.getFullYear();
    const monthsWorked = ((rescDate.getFullYear() - admissionDate.getFullYear()) * 12) + 
                        (rescDate.getMonth() - admissionDate.getMonth());
    
    // Calcular salário base mensal
    let monthlySalary = 0;
    if (employee.salary.type === 'hourly') {
      // Professor: horas semanais × valor hora × 4.5 semanas
      monthlySalary = (employee.salary.weeklyHours || 0) * employee.salary.value * 4.5;
    } else {
      // Auxiliar: salário fixo
      monthlySalary = employee.salary.value;
    }

    // Calcular DSR e Hora Atividade para professores
    let dsr = 0;
    let hourActivity = 0;
    if (employee.salary.type === 'hourly') {
      dsr = monthlySalary * (1/6); // DSR = 1/6 do salário base
      hourActivity = (monthlySalary + dsr) * 0.05; // 5% sobre base + DSR
    }

    const grossSalary = monthlySalary + dsr + hourActivity;

    // Itens de rescisão
    const items: RescisionItem[] = [];

    // 1. Saldo de Salário (proporcional aos dias trabalhados no mês)
    const workingDays = rescDate.getDate();
    const totalDaysInMonth = new Date(rescDate.getFullYear(), rescDate.getMonth() + 1, 0).getDate();
    const salaryBalance = grossSalary * (workingDays / totalDaysInMonth);
    
    items.push({
      code: '050',
      description: `Saldo de ${workingDays}/${totalDaysInMonth} dias Salário`,
      value: salaryBalance,
      type: 'earning',
      calculation: `R$ ${grossSalary.toFixed(2)} × ${workingDays}/${totalDaysInMonth}`
    });

    // 2. Aviso Prévio (se aplicável)
    let priorNoticeValue = 0;
    if (priorNoticeType === 'indenizado' && ['demissao_sem_justa_causa', 'rescisao_indireta'].includes(rescisionType)) {
      // 30 dias + 3 dias por ano trabalhado (máximo 90 dias)
      const priorNoticeDays = Math.min(30 + (yearsWorked * 3), 90);
      priorNoticeValue = grossSalary * (priorNoticeDays / 30);
      
      items.push({
        code: '069',
        description: `Aviso Prévio Indenizado ${priorNoticeDays} dias`,
        value: priorNoticeValue,
        type: 'earning',
        calculation: `R$ ${grossSalary.toFixed(2)} × ${priorNoticeDays}/30`
      });
    } else if (priorNoticeType === 'indenizado' && rescisionType === 'acordo_comum') {
      // Acordo: 50% do aviso prévio
      const priorNoticeDays = Math.min(30 + (yearsWorked * 3), 90);
      priorNoticeValue = (grossSalary * (priorNoticeDays / 30)) * 0.5;
      
      items.push({
        code: '069',
        description: `Aviso Prévio Indenizado ${priorNoticeDays} dias (50% - Acordo)`,
        value: priorNoticeValue,
        type: 'earning',
        calculation: `R$ ${grossSalary.toFixed(2)} × ${priorNoticeDays}/30 × 50%`
      });
    }

    // 3. 13º Salário Proporcional
    if (!['justa_causa'].includes(rescisionType)) {
      const thirteenthSalary = grossSalary * (monthsWorked / 12);
      items.push({
        code: '063',
        description: `13º Salário Proporcional ${monthsWorked}/12 avos`,
        value: thirteenthSalary,
        type: 'earning',
        calculation: `R$ ${grossSalary.toFixed(2)} × ${monthsWorked}/12`
      });

      // 13º sobre aviso prévio (se houver)
      if (priorNoticeValue > 0) {
        const thirteenthOnNotice = priorNoticeValue / 12;
        items.push({
          code: '070',
          description: '13º Salário (Aviso Prévio Indenizado)',
          value: thirteenthOnNotice,
          type: 'earning',
          calculation: `R$ ${priorNoticeValue.toFixed(2)} ÷ 12`
        });
      }
    }

    // 4. Férias Proporcionais
    if (!['justa_causa'].includes(rescisionType)) {
      const proportionalVacation = grossSalary * (monthsWorked / 12);
      const vacationThird = proportionalVacation / 3;
      
      items.push({
        code: '065',
        description: `Férias Proporcionais ${monthsWorked}/12 avos`,
        value: proportionalVacation,
        type: 'earning',
        calculation: `R$ ${grossSalary.toFixed(2)} × ${monthsWorked}/12`
      });

      items.push({
        code: '068',
        description: 'Terço Constitucional de Férias',
        value: vacationThird,
        type: 'earning',
        calculation: `R$ ${proportionalVacation.toFixed(2)} ÷ 3`
      });

      // Férias sobre aviso prévio (se houver)
      if (priorNoticeValue > 0) {
        const vacationOnNotice = priorNoticeValue / 12;
        const vacationThirdOnNotice = vacationOnNotice / 3;
        
        items.push({
          code: '071',
          description: 'Férias (Aviso Prévio Indenizado)',
          value: vacationOnNotice,
          type: 'earning',
          calculation: `R$ ${priorNoticeValue.toFixed(2)} ÷ 12`
        });

        items.push({
          code: '068',
          description: 'Terço Constitucional de Férias (Aviso Prévio)',
          value: vacationThirdOnNotice,
          type: 'earning',
          calculation: `R$ ${vacationOnNotice.toFixed(2)} ÷ 3`
        });
      }
    }

    // 5. Férias Vencidas (se aplicável)
    if (hasVacationDue && !['justa_causa'].includes(rescisionType)) {
      const vacationDue = grossSalary;
      const vacationThirdDue = vacationDue / 3;
      
      items.push({
        code: '066.1',
        description: 'Férias Vencidas Período Aquisitivo',
        value: vacationDue,
        type: 'earning',
        calculation: `R$ ${grossSalary.toFixed(2)} (período completo)`
      });

      items.push({
        code: '068',
        description: 'Terço Constitucional de Férias Vencidas',
        value: vacationThirdDue,
        type: 'earning',
        calculation: `R$ ${vacationDue.toFixed(2)} ÷ 3`
      });
    }

    // Calcular total bruto
    const totalGross = items.reduce((sum, item) => sum + (item.type === 'earning' ? item.value : 0), 0);

    // 6. Deduções
    // INSS
    const inssValue = this.calculateINSS(totalGross);
    if (inssValue > 0) {
      items.push({
        code: '112.1',
        description: 'Previdência Social',
        value: inssValue,
        type: 'deduction',
        calculation: `INSS sobre R$ ${totalGross.toFixed(2)}`
      });
    }

    // IRRF
    const irrfBase = totalGross - inssValue;
    const irrfValue = this.calculateIRRF(irrfBase, 0);
    if (irrfValue > 0) {
      items.push({
        code: '114.1',
        description: 'IRRF',
        value: irrfValue,
        type: 'deduction',
        calculation: `IRRF sobre R$ ${irrfBase.toFixed(2)}`
      });
    }

    const totalDeductions = items.reduce((sum, item) => sum + (item.type === 'deduction' ? item.value : 0), 0);
    const netValue = totalGross - totalDeductions;

    // FGTS
    const fgtsDeposit = totalGross * 0.08;
    let fgtsFine = 0;
    
    if (rescisionType === 'demissao_sem_justa_causa' || rescisionType === 'rescisao_indireta') {
      fgtsFine = (grossSalary * monthsWorked * 0.08) * 0.40; // 40% sobre saldo FGTS
    } else if (rescisionType === 'acordo_comum') {
      fgtsFine = (grossSalary * monthsWorked * 0.08) * 0.20; // 20% sobre saldo FGTS
    }

    return {
      employee,
      rescisionType,
      rescisionDate,
      priorNoticeType,
      hasVacationDue,
      calculation: {
        workingDays,
        monthsWorked,
        items,
        totalGross,
        totalDeductions,
        netValue,
        fgtsDeposit,
        fgtsFine,
        grossSalary
      }
    };
  },

  /**
   * Calcula INSS progressivo
   */
  calculateINSS(baseValue: number): number {
    const brackets = [
      { min: 0, max: 1412.00, rate: 0.075 },
      { min: 1412.01, max: 2666.68, rate: 0.09 },
      { min: 2666.69, max: 4000.03, rate: 0.12 },
      { min: 4000.04, max: 7786.02, rate: 0.14 }
    ];
    
    let inss = 0;
    let remaining = baseValue;
    
    for (const bracket of brackets) {
      if (remaining <= 0) break;
      
      const taxableInBracket = Math.min(remaining, bracket.max - bracket.min + 0.01);
      if (taxableInBracket > 0) {
        inss += taxableInBracket * bracket.rate;
        remaining -= taxableInBracket;
      }
    }
    
    return Math.min(inss, 908.85); // Teto INSS 2024
  },

  /**
   * Calcula IRRF
   */
  calculateIRRF(baseValue: number, dependents: number = 0): number {
    const dependentDeduction = dependents * 189.59;
    const taxableValue = Math.max(0, baseValue - dependentDeduction);
    
    const brackets = [
      { min: 0, max: 2259.20, rate: 0, deduction: 0 },
      { min: 2259.21, max: 2826.65, rate: 0.075, deduction: 169.44 },
      { min: 2826.66, max: 3751.05, rate: 0.15, deduction: 381.44 },
      { min: 3751.06, max: 4664.68, rate: 0.225, deduction: 662.77 },
      { min: 4664.69, max: 999999, rate: 0.275, deduction: 896.00 }
    ];
    
    const bracket = brackets.find(b => taxableValue >= b.min && taxableValue <= b.max);
    if (!bracket || bracket.rate === 0) return 0;
    
    return Math.max(0, taxableValue * bracket.rate - bracket.deduction);
  }
};
