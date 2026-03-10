/**
 * API para configurações administrativas do sistema
 * Permite personalizar fórmulas, tabelas e valores
 */
import { request } from './http';

export interface HourlyRateConfig {
  level: string;
  value: number;
  description: string;
}

export interface INSSConfig {
  minValue: number;
  maxValue: number;
  rate: number;
  deduction: number;
  description: string;
}

export interface IRRFConfig {
  minValue: number;
  maxValue: number;
  rate: number;
  deduction: number;
  dependentDeduction: number;
  description: string;
}

export interface FormulaConfig {
  name: string;
  formula: string;
  description: string;
  variables: string[];
}

export interface BenefitsConfig {
  transportValue: number;
  mealValue: number;
  transportDeductionPercent: number;
  mealDeductionPercent: number;
}

export interface SystemConfig {
  hourlyRates: HourlyRateConfig[];
  monthlySalaries: { [key: string]: number };
  inssTable: INSSConfig[];
  irrfTable: IRRFConfig[];
  formulas: FormulaConfig[];
  benefits: BenefitsConfig;
  percentages: {
    dsr: number; // 1/6 = 0.1667
    hourActivity: number; // 5% = 0.05
    fgts: number; // 8% = 0.08
    vacationThird: number; // 1/3 = 0.3333
  };
  workDays: {
    defaultMonthlyDays: number;
    weekMultiplier: number; // 4.5 semanas por mês
  };
}

const evaluateFormulaExpression = (expression: string) => {
  const tokens = expression.match(/\d+(?:\.\d+)?|[()+\-*/]/g) ?? [];
  let index = 0;

  const peek = () => tokens[index];
  const next = () => tokens[index++];

  const parseFactor = (): number => {
    const token = next();
    if (token === undefined) throw new Error('Unexpected end of expression');

    if (token === '(') {
      const value = parseExpression();
      if (next() !== ')') throw new Error('Missing closing parenthesis');
      return value;
    }

    if (token === '-') {
      return -parseFactor();
    }

    const numberValue = Number(token);
    if (Number.isNaN(numberValue)) throw new Error(`Invalid token: ${token}`);
    return numberValue;
  };

  const parseTerm = (): number => {
    let value = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const operator = next();
      const right = parseFactor();
      if (operator === '*') value *= right;
      if (operator === '/') value /= right;
    }
    return value;
  };

  const parseExpression = (): number => {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const operator = next();
      const right = parseTerm();
      if (operator === '+') value += right;
      if (operator === '-') value -= right;
    }
    return value;
  };

  const result = parseExpression();
  if (index < tokens.length) throw new Error('Unexpected token');
  return result;
};

// Configuração atual baseada na planilha
const currentConfig: SystemConfig = {
  hourlyRates: [
    {
      level: 'infantil',
      value: 26.45,
      description: 'Ensino Infantil'
    },
    {
      level: 'fundamental1',
      value: 26.45,
      description: 'Ensino Fundamental I'
    },
    {
      level: 'fundamental2',
      value: 31.44,
      description: 'Ensino Fundamental II'
    },
    {
      level: 'medio',
      value: 31.44,
      description: 'Ensino Médio'
    },
    {
      level: 'pre_vestibular',
      value: 47.02,
      description: 'Pré-Vestibular'
    },
    {
      level: 'ro_efi',
      value: 26.02,
      description: 'Reforço Fundamental I'
    },
    {
      level: 'ro_efii',
      value: 28.88,
      description: 'Reforço Fundamental II'
    }
  ],
  monthlySalaries: {
    'auxiliar_limpeza': 1954.58,
    'auxiliar_administrativo': 1954.58,
    'auxiliar_escritorio': 1700.00
  },
  inssTable: [
    {
      minValue: 0,
      maxValue: 1412.00,
      rate: 0.075,
      deduction: 0,
      description: 'Faixa 1 - 7,5%'
    },
    {
      minValue: 1412.01,
      maxValue: 2666.68,
      rate: 0.09,
      deduction: 21.18,
      description: 'Faixa 2 - 9%'
    },
    {
      minValue: 2666.69,
      maxValue: 4000.03,
      rate: 0.12,
      deduction: 101.18,
      description: 'Faixa 3 - 12%'
    },
    {
      minValue: 4000.04,
      maxValue: 7786.02,
      rate: 0.14,
      deduction: 181.18,
      description: 'Faixa 4 - 14%'
    }
  ],
  irrfTable: [
    {
      minValue: 0,
      maxValue: 2259.20,
      rate: 0,
      deduction: 0,
      dependentDeduction: 189.59,
      description: 'Isento'
    },
    {
      minValue: 2259.21,
      maxValue: 2826.65,
      rate: 0.075,
      deduction: 169.44,
      dependentDeduction: 189.59,
      description: '7,5%'
    },
    {
      minValue: 2826.66,
      maxValue: 3751.05,
      rate: 0.15,
      deduction: 381.44,
      dependentDeduction: 189.59,
      description: '15%'
    },
    {
      minValue: 3751.06,
      maxValue: 4664.68,
      rate: 0.225,
      deduction: 662.77,
      dependentDeduction: 189.59,
      description: '22,5%'
    },
    {
      minValue: 4664.69,
      maxValue: 999999,
      rate: 0.275,
      deduction: 896.00,
      dependentDeduction: 189.59,
      description: '27,5%'
    }
  ],
  formulas: [
    {
      name: 'salario_professor',
      formula: '(horas_semanais * valor_hora * 4.5)',
      description: 'Salário base do professor',
      variables: ['horas_semanais', 'valor_hora']
    },
    {
      name: 'dsr',
      formula: 'salario_base * (1/6)',
      description: 'Descanso Semanal Remunerado',
      variables: ['salario_base']
    },
    {
      name: 'hora_atividade',
      formula: '(salario_base + dsr) * 0.05',
      description: 'Hora Atividade (5%)',
      variables: ['salario_base', 'dsr']
    },
    {
      name: 'salario_bruto',
      formula: 'salario_base + dsr + hora_atividade',
      description: 'Salário Bruto Total',
      variables: ['salario_base', 'dsr', 'hora_atividade']
    },
    {
      name: 'falta_proporcional',
      formula: 'salario_bruto * (dias_trabalhados / dias_uteis)',
      description: 'Desconto proporcional por faltas',
      variables: ['salario_bruto', 'dias_trabalhados', 'dias_uteis']
    }
  ],
  benefits: {
    transportValue: 5.00, // Por viagem
    mealValue: 25.00, // Por dia
    transportDeductionPercent: 0.06, // 6% do salário
    mealDeductionPercent: 0 // Isento
  },
  percentages: {
    dsr: 1/6, // 16.67%
    hourActivity: 0.05, // 5%
    fgts: 0.08, // 8%
    vacationThird: 1/3 // 33.33%
  },
  workDays: {
    defaultMonthlyDays: 22,
    weekMultiplier: 4.5
  }
};

export const configApi = {
  /**
   * Busca configuração atual do sistema
   */
  async getSystemConfig(): Promise<SystemConfig> {
    try {
      const remote = await request<SystemConfig | null>('/system-config');
      if (remote) {
        Object.assign(currentConfig, remote);
      }
    } catch {
      // fallback to in-memory defaults
    }
    return currentConfig;
  },

  /**
   * Atualiza configuração do sistema
   */
  async updateSystemConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
    Object.assign(currentConfig, config);
    try {
      await request<SystemConfig>('/system-config', {
        method: 'PATCH',
        body: JSON.stringify(config)
      });
    } catch {
      // persist failure is non-fatal; in-memory state is still updated
    }
    return currentConfig;
  },

  /**
   * Atualiza apenas os valores das horas aula
   */
  async updateHourlyRates(rates: HourlyRateConfig[]): Promise<HourlyRateConfig[]> {
    currentConfig.hourlyRates = rates;
    await this.updateSystemConfig({ hourlyRates: rates });
    return rates;
  },

  /**
   * Atualiza tabela do INSS
   */
  async updateINSSTable(table: INSSConfig[]): Promise<INSSConfig[]> {
    currentConfig.inssTable = table;
    await this.updateSystemConfig({ inssTable: table });
    return table;
  },

  /**
   * Atualiza tabela do IRRF
   */
  async updateIRRFTable(table: IRRFConfig[]): Promise<IRRFConfig[]> {
    currentConfig.irrfTable = table;
    await this.updateSystemConfig({ irrfTable: table });
    return table;
  },

  /**
   * Atualiza fórmulas de cálculo
   */
  async updateFormulas(formulas: FormulaConfig[]): Promise<FormulaConfig[]> {
    currentConfig.formulas = formulas;
    await this.updateSystemConfig({ formulas });
    return formulas;
  },

  /**
   * Atualiza configurações de benefícios
   */
  async updateBenefits(benefits: BenefitsConfig): Promise<BenefitsConfig> {
    currentConfig.benefits = benefits;
    await this.updateSystemConfig({ benefits });
    return benefits;
  },

  /**
   * Valida fórmula customizada
   */
  async validateFormula(formula: string, variables: string[]): Promise<{
    isValid: boolean;
    error?: string;
    testResult?: number;
  }> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      // Simulação de validação
      const hasAllVariables = variables.every(v => formula.includes(v));
      
      if (!hasAllVariables) {
        return {
          isValid: false,
          error: 'Fórmula deve conter todas as variáveis necessárias'
        };
      }
      
      // Teste com valores simulados
      let testFormula = formula;
      variables.forEach(variable => {
        testFormula = testFormula.replace(new RegExp(variable, 'g'), '100');
      });
      
      const sanitizedFormula = testFormula.replace(/[^0-9+\-*/().\s]/g, '');
      const testResult = evaluateFormulaExpression(sanitizedFormula);
      
      return {
        isValid: true,
        testResult
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Fórmula inválida'
      };
    }
  },

  /**
   * Exporta configuração para backup
   */
  async exportConfig(): Promise<string> {
    const config = await this.getSystemConfig();
    return JSON.stringify(config, null, 2);
  },

  /**
   * Importa configuração de backup
   */
  async importConfig(configData: string): Promise<SystemConfig> {
    let importedConfig: SystemConfig;
    try {
      importedConfig = JSON.parse(configData);
    } catch {
      throw new Error('Arquivo de configuração inválido');
    }
    Object.assign(currentConfig, importedConfig);
    try {
      await request<SystemConfig>('/system-config', {
        method: 'PUT',
        body: JSON.stringify(importedConfig)
      });
    } catch {
      // non-fatal
    }
    return currentConfig;
  },

  /**
   * Calcula salário usando configurações atuais
   */
  async calculateSalaryWithConfig(
    employeeData: {
      type: 'hourly' | 'monthly';
      level?: string;
      weeklyHours?: number;
      monthlySalary?: number;
      position?: string;
    },
    workData: {
      workDays: number;
      absences: number;
      overtime?: number;
    }
  ): Promise<{
    baseSalary: number;
    dsr: number;
    hourActivity: number;
    grossSalary: number;
    netSalary: number;
    inss: number;
    irrf: number;
    fgts: number;
    breakdown: any;
  }> {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const config = currentConfig;
    let baseSalary = 0;
    let dsr = 0;
    let hourActivity = 0;
    
    if (employeeData.type === 'hourly') {
      // Professor
      const hourlyRate = config.hourlyRates.find(h => h.level === employeeData.level);
      if (hourlyRate && employeeData.weeklyHours) {
        baseSalary = employeeData.weeklyHours * hourlyRate.value * config.workDays.weekMultiplier;
        dsr = baseSalary * config.percentages.dsr;
        hourActivity = (baseSalary + dsr) * config.percentages.hourActivity;
      }
    } else {
      // Auxiliar
      const monthlySalary = employeeData.monthlySalary || 
        config.monthlySalaries[employeeData.position || 'auxiliar_limpeza'] || 0;
      baseSalary = monthlySalary;
    }
    
    // Aplicar faltas
    const grossSalary = (baseSalary + dsr + hourActivity) * 
      ((workData.workDays - workData.absences) / workData.workDays);
    
    // Calcular descontos
    const inss = this.calculateINSSWithConfig(grossSalary, config.inssTable);
    const irrf = this.calculateIRRFWithConfig(grossSalary - inss, config.irrfTable, 0);
    const fgts = grossSalary * config.percentages.fgts;
    
    const netSalary = grossSalary - inss - irrf;
    
    return {
      baseSalary,
      dsr,
      hourActivity,
      grossSalary,
      netSalary,
      inss,
      irrf,
      fgts,
      breakdown: {
        config: config,
        calculations: {
          baseSalaryFormula: employeeData.type === 'hourly' ? 
            `${employeeData.weeklyHours} × ${config.hourlyRates.find(h => h.level === employeeData.level)?.value} × ${config.workDays.weekMultiplier}` :
            `Salário fixo: ${baseSalary}`,
          dsrFormula: `${baseSalary} × ${config.percentages.dsr}`,
          hourActivityFormula: `(${baseSalary} + ${dsr}) × ${config.percentages.hourActivity}`
        }
      }
    };
  },

  /**
   * Calcula INSS com configuração personalizada
   */
  calculateINSSWithConfig(baseValue: number, inssTable: INSSConfig[]): number {
    for (const bracket of inssTable) {
      if (baseValue >= bracket.minValue && baseValue <= bracket.maxValue) {
        const calculated = baseValue * bracket.rate - bracket.deduction;
        return Math.max(0, calculated);
      }
    }
    return 0;
  },

  /**
   * Calcula IRRF com configuração personalizada
   */
  calculateIRRFWithConfig(baseValue: number, irrfTable: IRRFConfig[], dependents: number): number {
    const dependentDeduction = dependents * (irrfTable[0]?.dependentDeduction || 189.59);
    const taxableValue = Math.max(0, baseValue - dependentDeduction);
    
    for (const bracket of irrfTable) {
      if (taxableValue >= bracket.minValue && taxableValue <= bracket.maxValue) {
        const calculated = taxableValue * bracket.rate - bracket.deduction;
        return Math.max(0, calculated);
      }
    }
    return 0;
  }
};
