import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private buildEmployeeData(data: any) {
    const cpf = data.cpf ? data.cpf.replace(/\D/g, '') : undefined;
    const unionCnpj = data.esocialUnionCnpj ? data.esocialUnionCnpj.replace(/\D/g, '') : undefined;
    const addressLine = data.address?.street
      ? `${data.address.street}, ${data.address.number}${data.address.complement ? ` - ${data.address.complement}` : ''}`
      : data.addressLine;

    const toDate = (value: unknown) => {
      if (!value) return undefined;
      const parsed = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    };

    const toNumber = (value: unknown) => {
      if (value === null || value === undefined || value === '') return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    return {
      fullName: data.fullName,
      cpf,
      rg: data.rg,
      rgIssuer: data.rgIssuer,
      rgIssuerState: data.rgIssuerState,
      rgIssueDate: toDate(data.rgIssueDate),
      birthDate: toDate(data.birthDate),
      motherName: data.motherName,
      socialName: data.socialName,
      gender: data.gender,
      raceColor: data.raceColor,
      maritalStatus: data.maritalStatus,
      educationLevel: data.educationLevel,
      nationalityCode: data.nationalityCode,
      birthCountryCode: data.birthCountryCode,
      birthState: data.birthState,
      birthCityCode: data.birthCityCode,
      email: data.email,
      phone: data.phone,
      addressLine,
      city: data.address?.city ?? data.city,
      state: data.address?.state ?? data.state,
      zipCode: data.address?.zipCode ?? data.zipCode,
      cityCode: data.cityCode,
      employeeCode: data.employeeCode,
      admissionDate: toDate(data.admissionDate),
      ctps: data.ctps,
      ctpsNumber: data.ctpsNumber,
      ctpsSeries: data.ctpsSeries,
      ctpsState: data.ctpsState,
      pis: data.pis,
      esocialCategoryCode: data.esocialCategoryCode,
      esocialRegistrationType: data.esocialRegistrationType,
      esocialRegimeType: data.esocialRegimeType,
      esocialAdmissionType: data.esocialAdmissionType,
      esocialAdmissionIndicator: data.esocialAdmissionIndicator,
      esocialActivityNature: data.esocialActivityNature,
      esocialUnionCnpj: unionCnpj,
      esocialSalaryUnit: data.esocialSalaryUnit,
      esocialContractType: data.esocialContractType,
      esocialContractEndDate: toDate(data.esocialContractEndDate),
      esocialWeeklyHours: toNumber(data.esocialWeeklyHours),
      esocialWorkSchedule: data.esocialWorkSchedule,
      esocialHasDisability:
        data.esocialHasDisability === null || data.esocialHasDisability === undefined
          ? undefined
          : Boolean(data.esocialHasDisability),
      esocialDisabilityType: data.esocialDisabilityType,
      position: data.position,
      department: data.department,
      status: data.status,
      salaryType: data.salaryType,
      baseSalary: data.baseSalary,
      hourlyRate: data.hourlyRate,
      weeklyHours: data.weeklyHours,
      dependents: data.payrollData?.dependents ?? data.dependents,
      unionFee: data.payrollData?.unionFee ?? data.unionFee,
      transportVoucherValue: data.benefits?.transportVoucher?.monthlyValue ?? data.transportVoucherValue,
      mealVoucherValue: data.benefits?.mealVoucher?.monthlyValue ?? data.mealVoucherValue
    };
  }

  private async getEmployeeOrThrow(id: string, companyId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee || employee.companyId !== companyId || employee.deletedAt) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }

  private normalizeContractType(value?: string) {
    if (!value) return 'clt';
    const normalized = value.toLowerCase();
    if (normalized === 'clt' || normalized === 'temporary' || normalized === 'intern') return normalized;
    return 'clt';
  }

  async list(filters: { status?: string; department?: string; position?: string }, companyId: string) {
    return this.prisma.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: filters.status && filters.status !== 'all' ? (filters.status as any) : undefined,
        department: filters.department && filters.department !== 'all' ? filters.department : undefined,
        position:
          filters.position && filters.position !== 'all'
            ? { contains: filters.position, mode: 'insensitive' }
            : undefined
      },
      orderBy: { fullName: 'asc' }
    });
  }

  async listPending(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId, status: 'pending_approval', deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(data: any, companyId: string, userId?: string) {
    const mapped = this.buildEmployeeData(data);
    const employee = await this.prisma.employee.create({
      data: {
        companyId,
        ...mapped,
        status: mapped.status ?? 'pending_approval',
        dependents: mapped.dependents ?? 0,
        unionFee: mapped.unionFee ?? false
      }
    });

    const effectiveFrom = mapped.admissionDate ?? new Date();
    if (data.contractType || mapped.salaryType) {
      await this.prisma.employeeContract.create({
        data: {
          companyId,
          employeeId: employee.id,
          contractType: this.normalizeContractType(data.contractType),
          position: mapped.position ?? 'Colaborador',
          department: mapped.department ?? 'geral',
          salaryType: mapped.salaryType ?? 'monthly',
          baseSalary: mapped.baseSalary,
          hourlyRate: mapped.hourlyRate,
          weeklyHours: mapped.weeklyHours,
          effectiveFrom,
          status: 'pending',
          approvalStatus: 'pending',
          reason: data.reason
        }
      });
    }

    if (mapped.salaryType) {
      await this.prisma.employeeSalaryHistory.create({
        data: {
          companyId,
          employeeId: employee.id,
          salaryType: mapped.salaryType,
          baseSalary: mapped.baseSalary,
          hourlyRate: mapped.hourlyRate,
          weeklyHours: mapped.weeklyHours,
          effectiveFrom,
          approvalStatus: 'pending',
          reason: data.reason
        }
      });
    }

    if (mapped.transportVoucherValue) {
      await this.prisma.employeeBenefit.create({
        data: {
          employeeId: employee.id,
          type: 'transport',
          amount: mapped.transportVoucherValue,
          effectiveFrom,
          approvalStatus: 'pending',
          reason: data.reason
        }
      });
    }

    if (mapped.mealVoucherValue) {
      await this.prisma.employeeBenefit.create({
        data: {
          employeeId: employee.id,
          type: 'meal',
          amount: mapped.mealVoucherValue,
          effectiveFrom,
          approvalStatus: 'pending',
          reason: data.reason
        }
      });
    }

    await this.audit.log({
      companyId,
      userId,
      action: 'create',
      entity: 'employee',
      entityId: employee.id,
      after: employee
    });

    return employee;
  }

  async update(id: string, data: any, companyId: string, userId?: string, reason?: string) {
    const before = await this.getEmployeeOrThrow(id, companyId);
    const mapped = this.buildEmployeeData(data);

    const employee = await this.prisma.employee.update({
      where: { id },
      data: mapped
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'employee',
      entityId: id,
      reason,
      before,
      after: employee
    });

    return employee;
  }

  async softDelete(id: string, companyId: string, userId?: string, reason?: string) {
    const before = await this.getEmployeeOrThrow(id, companyId);
    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        deletedReason: reason ?? 'N/A'
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'delete',
      entity: 'employee',
      entityId: id,
      reason,
      before,
      after: employee
    });

    return employee;
  }

  async approve(id: string, companyId: string, userId?: string) {
    const before = await this.getEmployeeOrThrow(id, companyId);
    const employee = await this.prisma.employee.update({
      where: { id },
      data: { status: 'active' }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'approve',
      entity: 'employee',
      entityId: id,
      before,
      after: employee
    });

    return employee;
  }

  async reject(id: string, companyId: string, reason: string, userId?: string) {
    const before = await this.getEmployeeOrThrow(id, companyId);
    const employee = await this.prisma.employee.update({
      where: { id },
      data: { status: 'inactive' }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'reject',
      entity: 'employee',
      entityId: id,
      before,
      after: { ...employee, reason }
    });

    return employee;
  }

  async getById(id: string) {
    return this.prisma.employee.findUnique({ where: { id } });
  }

  async listContracts(employeeId: string, companyId: string) {
    await this.getEmployeeOrThrow(employeeId, companyId);
    return this.prisma.employeeContract.findMany({
      where: { employeeId, companyId, deletedAt: null },
      orderBy: { effectiveFrom: 'desc' }
    });
  }

  async createContract(employeeId: string, companyId: string, data: any, userId?: string) {
    await this.getEmployeeOrThrow(employeeId, companyId);

    const contract = await this.prisma.employeeContract.create({
      data: {
        companyId,
        employeeId,
        costCenterId: data.costCenterId,
        contractType: this.normalizeContractType(data.contractType),
        position: data.position,
        department: data.department,
        salaryType: data.salaryType,
        baseSalary: data.baseSalary,
        hourlyRate: data.hourlyRate,
        weeklyHours: data.weeklyHours,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
        status: data.status ?? 'pending',
        approvalStatus: data.approvalStatus ?? 'pending',
        reason: data.reason
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'create',
      entity: 'employee_contract',
      entityId: contract.id,
      reason: data.reason,
      after: contract
    });

    return contract;
  }

  async updateContract(contractId: string, companyId: string, data: any, userId?: string, reason?: string) {
    const before = await this.prisma.employeeContract.findUnique({ where: { id: contractId } });
    if (!before || before.companyId !== companyId || before.deletedAt) {
      throw new NotFoundException('Contract not found');
    }

    const contract = await this.prisma.employeeContract.update({
      where: { id: contractId },
      data: {
        costCenterId: data.costCenterId,
        contractType: data.contractType ? this.normalizeContractType(data.contractType) : undefined,
        position: data.position,
        department: data.department,
        salaryType: data.salaryType,
        baseSalary: data.baseSalary,
        hourlyRate: data.hourlyRate,
        weeklyHours: data.weeklyHours,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
        status: data.status,
        approvalStatus: data.approvalStatus,
        reason: data.reason ?? reason
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'employee_contract',
      entityId: contractId,
      reason: data.reason ?? reason,
      before,
      after: contract
    });

    return contract;
  }

  async approveContract(contractId: string, companyId: string, userId?: string, reason?: string) {
    const before = await this.prisma.employeeContract.findUnique({ where: { id: contractId } });
    if (!before || before.companyId !== companyId || before.deletedAt) {
      throw new NotFoundException('Contract not found');
    }

    const contract = await this.prisma.employeeContract.update({
      where: { id: contractId },
      data: {
        approvalStatus: 'approved',
        status: 'active',
        approvedBy: userId,
        approvedAt: new Date(),
        reason: reason ?? before.reason
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'approve',
      entity: 'employee_contract',
      entityId: contractId,
      reason,
      before,
      after: contract
    });

    return contract;
  }

  async rejectContract(contractId: string, companyId: string, reason: string, userId?: string) {
    const before = await this.prisma.employeeContract.findUnique({ where: { id: contractId } });
    if (!before || before.companyId !== companyId || before.deletedAt) {
      throw new NotFoundException('Contract not found');
    }

    const contract = await this.prisma.employeeContract.update({
      where: { id: contractId },
      data: {
        approvalStatus: 'rejected',
        status: 'inactive',
        reason
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'reject',
      entity: 'employee_contract',
      entityId: contractId,
      reason,
      before,
      after: contract
    });

    return contract;
  }

  async listSalaryHistory(employeeId: string, companyId: string) {
    await this.getEmployeeOrThrow(employeeId, companyId);
    return this.prisma.employeeSalaryHistory.findMany({
      where: { employeeId, companyId },
      orderBy: { effectiveFrom: 'desc' }
    });
  }

  async createSalaryHistory(employeeId: string, companyId: string, data: any, userId?: string) {
    await this.getEmployeeOrThrow(employeeId, companyId);

    const history = await this.prisma.employeeSalaryHistory.create({
      data: {
        companyId,
        employeeId,
        salaryType: data.salaryType,
        baseSalary: data.baseSalary,
        hourlyRate: data.hourlyRate,
        weeklyHours: data.weeklyHours,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
        approvalStatus: data.approvalStatus ?? 'pending',
        reason: data.reason
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'create',
      entity: 'employee_salary_history',
      entityId: history.id,
      reason: data.reason,
      after: history
    });

    return history;
  }

  async updateSalaryHistory(historyId: string, companyId: string, data: any, userId?: string, reason?: string) {
    const before = await this.prisma.employeeSalaryHistory.findUnique({ where: { id: historyId } });
    if (!before || before.companyId !== companyId) {
      throw new NotFoundException('Salary history not found');
    }

    const history = await this.prisma.employeeSalaryHistory.update({
      where: { id: historyId },
      data: {
        salaryType: data.salaryType,
        baseSalary: data.baseSalary,
        hourlyRate: data.hourlyRate,
        weeklyHours: data.weeklyHours,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
        approvalStatus: data.approvalStatus,
        reason: data.reason ?? reason
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'employee_salary_history',
      entityId: historyId,
      reason: data.reason ?? reason,
      before,
      after: history
    });

    return history;
  }

  async approveSalaryHistory(historyId: string, companyId: string, userId?: string, reason?: string) {
    const before = await this.prisma.employeeSalaryHistory.findUnique({ where: { id: historyId } });
    if (!before || before.companyId !== companyId) {
      throw new NotFoundException('Salary history not found');
    }

    const history = await this.prisma.employeeSalaryHistory.update({
      where: { id: historyId },
      data: {
        approvalStatus: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        reason: reason ?? before.reason
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'approve',
      entity: 'employee_salary_history',
      entityId: historyId,
      reason,
      before,
      after: history
    });

    return history;
  }

  async rejectSalaryHistory(historyId: string, companyId: string, reason: string, userId?: string) {
    const before = await this.prisma.employeeSalaryHistory.findUnique({ where: { id: historyId } });
    if (!before || before.companyId !== companyId) {
      throw new NotFoundException('Salary history not found');
    }

    const history = await this.prisma.employeeSalaryHistory.update({
      where: { id: historyId },
      data: {
        approvalStatus: 'rejected',
        reason
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'reject',
      entity: 'employee_salary_history',
      entityId: historyId,
      reason,
      before,
      after: history
    });

    return history;
  }

  async listBenefits(employeeId: string, companyId: string) {
    await this.getEmployeeOrThrow(employeeId, companyId);
    return this.prisma.employeeBenefit.findMany({
      where: { employeeId, deletedAt: null },
      orderBy: { effectiveFrom: 'desc' }
    });
  }

  async createBenefit(employeeId: string, companyId: string, data: any, userId?: string) {
    await this.getEmployeeOrThrow(employeeId, companyId);

    const benefit = await this.prisma.employeeBenefit.create({
      data: {
        employeeId,
        type: data.type,
        amount: data.amount,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
        approvalStatus: data.approvalStatus ?? 'pending',
        reason: data.reason
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'create',
      entity: 'employee_benefit',
      entityId: benefit.id,
      reason: data.reason,
      after: benefit
    });

    return benefit;
  }

  async updateBenefit(benefitId: string, companyId: string, data: any, userId?: string, reason?: string) {
    const before = await this.prisma.employeeBenefit.findUnique({ where: { id: benefitId } });
    if (!before || before.deletedAt) {
      throw new NotFoundException('Benefit not found');
    }

    const benefit = await this.prisma.employeeBenefit.update({
      where: { id: benefitId },
      data: {
        type: data.type,
        amount: data.amount,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
        approvalStatus: data.approvalStatus,
        reason: data.reason ?? reason
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'employee_benefit',
      entityId: benefitId,
      reason: data.reason ?? reason,
      before,
      after: benefit
    });

    return benefit;
  }

  async approveBenefit(benefitId: string, companyId: string, userId?: string, reason?: string) {
    const before = await this.prisma.employeeBenefit.findUnique({ where: { id: benefitId } });
    if (!before || before.deletedAt) {
      throw new NotFoundException('Benefit not found');
    }

    const benefit = await this.prisma.employeeBenefit.update({
      where: { id: benefitId },
      data: {
        approvalStatus: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        reason: reason ?? before.reason
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'approve',
      entity: 'employee_benefit',
      entityId: benefitId,
      reason,
      before,
      after: benefit
    });

    return benefit;
  }

  async rejectBenefit(benefitId: string, companyId: string, reason: string, userId?: string) {
    const before = await this.prisma.employeeBenefit.findUnique({ where: { id: benefitId } });
    if (!before || before.deletedAt) {
      throw new NotFoundException('Benefit not found');
    }

    const benefit = await this.prisma.employeeBenefit.update({
      where: { id: benefitId },
      data: {
        approvalStatus: 'rejected',
        reason
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'reject',
      entity: 'employee_benefit',
      entityId: benefitId,
      reason,
      before,
      after: benefit
    });

    return benefit;
  }

  async deleteBenefit(benefitId: string, companyId: string, userId?: string, reason?: string) {
    const before = await this.prisma.employeeBenefit.findUnique({ where: { id: benefitId } });
    if (!before || before.deletedAt) {
      throw new NotFoundException('Benefit not found');
    }

    const benefit = await this.prisma.employeeBenefit.update({
      where: { id: benefitId },
      data: { deletedAt: new Date() }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'delete',
      entity: 'employee_benefit',
      entityId: benefitId,
      reason,
      before,
      after: benefit
    });

    return benefit;
  }
}
