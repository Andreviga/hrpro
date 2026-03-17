import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private async buildExtraCleanupCandidates(companyId: string) {
    const rows = await this.prisma.employee.findMany({
      where: {
        companyId,
        deletedAt: null
      },
      select: {
        id: true,
        fullName: true,
        cpf: true,
        status: true,
        position: true,
        department: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            payrollResults: true,
            timeBankEntries: true,
            timeBankCloses: true,
            dependentsList: true,
            contracts: true,
            salaryHistory: true,
            benefits: true,
            rubricAssignments: true,
            attachments: true,
            users: true,
            documents: true,
            documentSignatures: true,
            supportTickets: true
          }
        }
      }
    });

    return rows
      .map((row) => {
        const links = {
          payrollResults: row._count.payrollResults,
          timeBankEntries: row._count.timeBankEntries,
          timeBankCloses: row._count.timeBankCloses,
          dependents: row._count.dependentsList,
          contracts: row._count.contracts,
          salaryHistory: row._count.salaryHistory,
          benefits: row._count.benefits,
          rubricAssignments: row._count.rubricAssignments,
          attachments: row._count.attachments,
          users: row._count.users,
          documents: row._count.documents,
          documentSignatures: row._count.documentSignatures,
          supportTickets: row._count.supportTickets
        };

        const totalLinks = Object.values(links).reduce((sum, value) => sum + Number(value || 0), 0);

        const statusEligible =
          row.status === 'pending_approval' || row.status === 'inactive' || row.status === 'dismissed';
        const candidate = statusEligible && totalLinks === 0;

        return {
          employee: {
            id: row.id,
            fullName: row.fullName,
            cpf: row.cpf,
            status: row.status,
            position: row.position,
            department: row.department,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          },
          links,
          totalLinks,
          candidate,
          reasons: [
            statusEligible ? 'status_eligible' : 'status_not_eligible',
            totalLinks === 0 ? 'no_related_records' : 'has_related_records'
          ]
        };
      })
      .filter((item) => item.candidate)
      .sort((a, b) => b.employee.updatedAt.getTime() - a.employee.updatedAt.getTime());
  }

  private isValidCpf(cpf: string) {
    if (!/^\d{11}$/.test(cpf)) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    const digits = cpf.split('').map(Number);
    const calcCheckDigit = (slice: number[], factorStart: number) => {
      const total = slice.reduce((sum, digit, idx) => sum + digit * (factorStart - idx), 0);
      const mod = (total * 10) % 11;
      return mod === 10 ? 0 : mod;
    };

    const check1 = calcCheckDigit(digits.slice(0, 9), 10);
    const check2 = calcCheckDigit(digits.slice(0, 10), 11);
    return check1 === digits[9] && check2 === digits[10];
  }

  private hasLetters(value?: string | null) {
    return /[A-Za-zÀ-ÿ]/.test(String(value ?? ''));
  }

  private validateEmployeeInput(rawData: any, mapped: any, mode: 'create' | 'update') {
    const shouldValidate = (fieldName: string) => mode === 'create' || Object.prototype.hasOwnProperty.call(rawData, fieldName);

    if (mode === 'create' && !String(mapped.fullName ?? '').trim()) {
      throw new BadRequestException('Nome completo é obrigatório.');
    }

    if (shouldValidate('fullName') && String(mapped.fullName ?? '').trim() && !this.hasLetters(mapped.fullName)) {
      throw new BadRequestException('Nome completo inválido.');
    }

    if (mode === 'create' && !String(mapped.cpf ?? '').trim()) {
      throw new BadRequestException('CPF é obrigatório.');
    }

    if (shouldValidate('cpf') && mapped.cpf && !this.isValidCpf(mapped.cpf)) {
      throw new BadRequestException('CPF inválido.');
    }

    if (mode === 'create' && !String(mapped.email ?? '').trim()) {
      throw new BadRequestException('E-mail é obrigatório.');
    }

    if (shouldValidate('email') && mapped.email) {
      const email = String(mapped.email).trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new BadRequestException('E-mail inválido.');
      }
    }

    if (mode === 'create' && !String(mapped.position ?? '').trim()) {
      throw new BadRequestException('Cargo é obrigatório.');
    }

    if (shouldValidate('position') && String(mapped.position ?? '').trim() && !this.hasLetters(mapped.position)) {
      throw new BadRequestException('Cargo inválido.');
    }

    if (mode === 'create' && !mapped.admissionDate) {
      throw new BadRequestException('Data de admissão é obrigatória.');
    }

    if (shouldValidate('admissionDate') && mapped.admissionDate) {
      const admissionDate = mapped.admissionDate as Date;
      const year = admissionDate.getFullYear();
      const today = new Date();
      if (year < 1950 || admissionDate.getTime() > today.getTime()) {
        throw new BadRequestException('Data de admissão inválida.');
      }
    }
  }

  private buildEmployeeData(data: any) {
    const cpf = data.cpf ? data.cpf.replace(/\D/g, '') : undefined;
    const employerCnpj = data.employerCnpj ? data.employerCnpj.replace(/\D/g, '') : undefined;
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
      employerCnpj,
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
      bankName: data.bankName,
      bankAgency: data.bankAgency,
      bankAccount: data.bankAccount,
      paymentMethod: data.paymentMethod,
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

  async list(filters: { status?: string; department?: string; position?: string; employerCnpj?: string }, companyId: string) {
    const employerCnpj = filters.employerCnpj?.replace(/\D/g, '');

    return this.prisma.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: filters.status && filters.status !== 'all' ? (filters.status as any) : undefined,
        department: filters.department && filters.department !== 'all' ? filters.department : undefined,
        employerCnpj: employerCnpj && employerCnpj !== 'all' ? employerCnpj : undefined,
        position:
          filters.position && filters.position !== 'all'
            ? { contains: filters.position, mode: 'insensitive' }
            : undefined
      },
      orderBy: { fullName: 'asc' }
    });
  }

  async listExtraCleanupCandidates(companyId: string) {
    const candidates = await this.buildExtraCleanupCandidates(companyId);
    return {
      totalCandidates: candidates.length,
      candidates
    };
  }

  async cleanupExtraEmployees(params: {
    companyId: string;
    userId?: string;
    employeeIds?: string[];
    execute?: boolean;
    reason?: string;
  }) {
    const candidates = await this.buildExtraCleanupCandidates(params.companyId);
    const candidateIds = new Set(candidates.map((item) => item.employee.id));

    const selectedCandidates =
      params.employeeIds && params.employeeIds.length > 0
        ? candidates.filter((item) => candidateIds.has(item.employee.id) && params.employeeIds?.includes(item.employee.id))
        : candidates;

    const execute = Boolean(params.execute);
    if (!execute || selectedCandidates.length === 0) {
      return {
        execute,
        totalCandidates: candidates.length,
        selectedCount: selectedCandidates.length,
        deletedCount: 0,
        deletedEmployeeIds: [] as string[],
        candidates: selectedCandidates
      };
    }

    const now = new Date();
    const deletedEmployeeIds: string[] = [];

    for (const item of selectedCandidates) {
      const employee = await this.prisma.employee.update({
        where: { id: item.employee.id },
        data: {
          deletedAt: now,
          deletedBy: params.userId,
          deletedReason: params.reason ?? 'cleanup_extra_employees'
        }
      });

      deletedEmployeeIds.push(employee.id);

      await this.audit.log({
        companyId: params.companyId,
        userId: params.userId,
        action: 'delete',
        entity: 'employee',
        entityId: employee.id,
        reason: params.reason ?? 'cleanup_extra_employees',
        before: item.employee,
        after: {
          id: employee.id,
          deletedAt: employee.deletedAt,
          deletedBy: employee.deletedBy,
          deletedReason: employee.deletedReason
        }
      });
    }

    return {
      execute,
      totalCandidates: candidates.length,
      selectedCount: selectedCandidates.length,
      deletedCount: deletedEmployeeIds.length,
      deletedEmployeeIds,
      candidates: selectedCandidates
    };
  }

  async listPending(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId, status: 'pending_approval', deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(data: any, companyId: string, userId?: string) {
    const mapped = this.buildEmployeeData(data);
    this.validateEmployeeInput(data, mapped, 'create');

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
    this.validateEmployeeInput(data, mapped, 'update');

    if (before.status === 'dismissed' && mapped.status && mapped.status !== 'dismissed') {
      mapped.status = 'dismissed';
    }

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
    if (before.status === 'dismissed') {
      throw new ConflictException('Funcionário desligado não pode ser reativado por aprovação.');
    }

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

