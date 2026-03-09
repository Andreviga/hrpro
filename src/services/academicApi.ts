/**
 * API para gerenciamento acadêmico: horários, calendário e aulas
 * Sistema completo de controle de aulas por professor
 */

export interface Subject {
  id: number;
  name: string;
  code: string;
  level: 'infantil' | 'fundamental1' | 'fundamental2' | 'medio' | 'pre_vestibular';
  hourlyRate: number;
}

export interface ClassSchedule {
  id: number;
  teacherId: number;
  teacherName: string;
  subjectId: number;
  subjectName: string;
  level: string;
  grade: string;
  weeklyHours: number;
  dayOfWeek: string[];
  timeSlots: string[];
  classroom?: string;
}

export interface SchoolCalendar {
  id: number;
  year: number;
  month: number;
  workingDays: number;
  holidays: Date[];
  events: CalendarEvent[];
  isActive: boolean;
}

export interface CalendarEvent {
  id: number;
  date: string;
  type: 'holiday' | 'event' | 'meeting' | 'vacation';
  title: string;
  description?: string;
  affectsClasses: boolean;
}

export interface MonthlyClasses {
  id: number;
  teacherId: number;
  teacherName: string;
  subjectId: number;
  subjectName: string;
  level: string;
  month: number;
  year: number;
  scheduledHours: number; // Horas programadas no horário
  actualHours: number; // Horas realmente dadas
  extraHours: number; // Aulas extras
  substitutionHours: number; // Substituições
  observations?: string;
  lastUpdated: string;
}

export interface ExtraClass {
  id: number;
  teacherId: number;
  teacherName: string;
  subjectName: string;
  level: string;
  date: string;
  hours: number;
  hourlyRate: number;
  type: 'extra' | 'substitution' | 'recovery' | 'reinforcement';
  description: string;
  authorizedBy: string;
  status: 'pending' | 'approved' | 'paid';
}

export interface TeacherScheduleSummary {
  teacherId: number;
  teacherName: string;
  totalWeeklyHours: number;
  subjects: {
    subject: string;
    level: string;
    weeklyHours: number;
    monthlyHours: number;
  }[];
  monthlyTotals: {
    [month: string]: {
      scheduled: number;
      actual: number;
      extra: number;
      total: number;
    };
  };
}

// Mock data baseado no horário 2025
const mockSubjects: Subject[] = [
  { id: 1, name: 'Português', code: 'PORT', level: 'fundamental2', hourlyRate: 31.44 },
  { id: 2, name: 'Matemática', code: 'MAT', level: 'fundamental2', hourlyRate: 31.44 },
  { id: 3, name: 'História', code: 'HIST', level: 'fundamental2', hourlyRate: 31.44 },
  { id: 4, name: 'Geografia', code: 'GEO', level: 'fundamental2', hourlyRate: 31.44 },
  { id: 5, name: 'Ciências', code: 'CIEN', level: 'fundamental2', hourlyRate: 31.44 },
  { id: 6, name: 'Inglês', code: 'ING', level: 'fundamental2', hourlyRate: 31.44 },
  { id: 7, name: 'Arte', code: 'ARTE', level: 'fundamental2', hourlyRate: 31.44 },
  { id: 8, name: 'Ed. Física', code: 'EDF', level: 'fundamental2', hourlyRate: 31.44 },
  { id: 9, name: 'Química', code: 'QUIM', level: 'medio', hourlyRate: 31.44 },
  { id: 10, name: 'Física', code: 'FIS', level: 'medio', hourlyRate: 31.44 },
  { id: 11, name: 'Biologia', code: 'BIO', level: 'medio', hourlyRate: 31.44 },
];

const mockSchedule: ClassSchedule[] = [
  {
    id: 1,
    teacherId: 1, // Amauri
    teacherName: 'AMAURI HERNANDES JUNIOR',
    subjectId: 3,
    subjectName: 'História',
    level: 'Fundamental II',
    grade: '8º ano',
    weeklyHours: 8,
    dayOfWeek: ['terça', 'quinta'],
    timeSlots: ['08:00-08:50', '08:50-09:40', '10:00-10:50', '10:50-11:40']
  },
  {
    id: 2,
    teacherId: 2, // Barbara
    teacherName: 'BARBARA GARCIA CAMARGO',
    subjectId: 9,
    subjectName: 'Química',
    level: 'Ensino Médio',
    grade: '1ª série',
    weeklyHours: 4,
    dayOfWeek: ['segunda', 'quarta'],
    timeSlots: ['08:00-08:50', '08:50-09:40']
  }
];

const mockCalendar: SchoolCalendar[] = [
  {
    id: 1,
    year: 2025,
    month: 1, // Janeiro
    workingDays: 22,
    holidays: [new Date('2025-01-01'), new Date('2025-01-25')],
    events: [
      {
        id: 1,
        date: '2025-01-01',
        type: 'holiday',
        title: 'Confraternização Universal',
        affectsClasses: true
      },
      {
        id: 2,
        date: '2025-01-25',
        type: 'holiday',
        title: 'Aniversário de São Paulo',
        affectsClasses: true
      }
    ],
    isActive: true
  },
  {
    id: 2,
    year: 2025,
    month: 2, // Fevereiro
    workingDays: 20,
    holidays: [],
    events: [],
    isActive: true
  }
];

const mockMonthlyClasses: MonthlyClasses[] = [
  {
    id: 1,
    teacherId: 1,
    teacherName: 'AMAURI HERNANDES JUNIOR',
    subjectId: 3,
    subjectName: 'História',
    level: 'Fundamental II',
    month: 1,
    year: 2025,
    scheduledHours: 36, // 8 aulas/semana × 4.5 semanas
    actualHours: 32, // Algumas aulas não foram dadas
    extraHours: 4, // Aulas extras
    substitutionHours: 2,
    observations: 'Faltou 1 dia por doença',
    lastUpdated: new Date().toISOString()
  }
];

const mockExtraClasses: ExtraClass[] = [
  {
    id: 1,
    teacherId: 1,
    teacherName: 'AMAURI HERNANDES JUNIOR',
    subjectName: 'História',
    level: 'Fundamental II',
    date: '2025-01-15',
    hours: 2,
    hourlyRate: 31.44,
    type: 'extra',
    description: 'Aula de reforço para recuperação',
    authorizedBy: 'Coordenação',
    status: 'approved'
  }
];

export const academicApi = {
  /**
   * Busca horário de aulas por professor
   */
  async getTeacherSchedule(teacherId: number): Promise<ClassSchedule[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockSchedule.filter(schedule => schedule.teacherId === teacherId);
  },

  /**
   * Busca todas as disciplinas
   */
  async getSubjects(): Promise<Subject[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockSubjects;
  },

  /**
   * Busca calendário escolar por ano
   */
  async getSchoolCalendar(year: number): Promise<SchoolCalendar[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockCalendar.filter(cal => cal.year === year);
  },

  /**
   * Busca aulas por professor e mês
   */
  async getMonthlyClasses(teacherId: number, month: number, year: number): Promise<MonthlyClasses[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockMonthlyClasses.filter(
      mc => mc.teacherId === teacherId && mc.month === month && mc.year === year
    );
  },

  /**
   * Atualiza aulas do mês
   */
  async updateMonthlyClasses(data: Partial<MonthlyClasses>): Promise<MonthlyClasses> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const index = mockMonthlyClasses.findIndex(
      mc => mc.teacherId === data.teacherId && mc.month === data.month && mc.year === data.year
    );
    
    if (index >= 0) {
      mockMonthlyClasses[index] = { ...mockMonthlyClasses[index], ...data, lastUpdated: new Date().toISOString() };
      return mockMonthlyClasses[index];
    } else {
      const newRecord: MonthlyClasses = {
        id: Date.now(),
        teacherId: data.teacherId!,
        teacherName: data.teacherName!,
        subjectId: data.subjectId!,
        subjectName: data.subjectName!,
        level: data.level!,
        month: data.month!,
        year: data.year!,
        scheduledHours: data.scheduledHours || 0,
        actualHours: data.actualHours || 0,
        extraHours: data.extraHours || 0,
        substitutionHours: data.substitutionHours || 0,
        observations: data.observations,
        lastUpdated: new Date().toISOString()
      };
      mockMonthlyClasses.push(newRecord);
      return newRecord;
    }
  },

  /**
   * Registra aula extra
   */
  async addExtraClass(extraClass: Omit<ExtraClass, 'id' | 'status'>): Promise<ExtraClass> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const newExtraClass: ExtraClass = {
      id: Date.now(),
      ...extraClass,
      status: 'pending'
    };
    
    mockExtraClasses.push(newExtraClass);
    return newExtraClass;
  },

  /**
   * Busca aulas extras por período
   */
  async getExtraClasses(teacherId?: number, month?: number, year?: number): Promise<ExtraClass[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    let classes = [...mockExtraClasses];
    
    if (teacherId) {
      classes = classes.filter(ec => ec.teacherId === teacherId);
    }
    
    if (month && year) {
      classes = classes.filter(ec => {
        const classDate = new Date(ec.date);
        return classDate.getMonth() + 1 === month && classDate.getFullYear() === year;
      });
    }
    
    return classes;
  },

  /**
   * Aprova/rejeita aula extra
   */
  async updateExtraClassStatus(id: number, status: 'approved' | 'rejected'): Promise<ExtraClass> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const index = mockExtraClasses.findIndex(ec => ec.id === id);
    if (index >= 0) {
      mockExtraClasses[index].status = status === 'approved' ? 'approved' : 'pending';
      return mockExtraClasses[index];
    }
    
    throw new Error('Aula extra não encontrada');
  },

  /**
   * Calcula resumo mensal de um professor
   */
  async getTeacherMonthlySummary(teacherId: number, month: number, year: number): Promise<{
    scheduledHours: number;
    actualHours: number;
    extraHours: number;
    substitutionHours: number;
    totalHours: number;
    totalValue: number;
    subjects: MonthlyClasses[];
  }> {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const monthlyClasses = await this.getMonthlyClasses(teacherId, month, year);
    const extraClasses = await this.getExtraClasses(teacherId, month, year);
    
    const scheduledHours = monthlyClasses.reduce((sum, mc) => sum + mc.scheduledHours, 0);
    const actualHours = monthlyClasses.reduce((sum, mc) => sum + mc.actualHours, 0);
    const extraHours = monthlyClasses.reduce((sum, mc) => sum + mc.extraHours, 0) + 
                      extraClasses.filter(ec => ec.status === 'approved').reduce((sum, ec) => sum + ec.hours, 0);
    const substitutionHours = monthlyClasses.reduce((sum, mc) => sum + mc.substitutionHours, 0);
    
    const totalHours = actualHours + extraHours + substitutionHours;
    
    // Calcular valor total baseado nas horas e valores por disciplina
    let totalValue = 0;
    for (const mc of monthlyClasses) {
      const subject = mockSubjects.find(s => s.id === mc.subjectId);
      if (subject) {
        totalValue += (mc.actualHours + mc.extraHours + mc.substitutionHours) * subject.hourlyRate;
      }
    }
    
    // Adicionar valor das aulas extras aprovadas
    for (const ec of extraClasses.filter(ec => ec.status === 'approved')) {
      totalValue += ec.hours * ec.hourlyRate;
    }
    
    return {
      scheduledHours,
      actualHours,
      extraHours,
      substitutionHours,
      totalHours,
      totalValue,
      subjects: monthlyClasses
    };
  },

  /**
   * Calcula horas programadas baseado no calendário
   */
  async calculateScheduledHours(teacherId: number, month: number, year: number): Promise<number> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const schedule = await this.getTeacherSchedule(teacherId);
    const calendar = await this.getSchoolCalendar(year);
    
    const monthCalendar = calendar.find(cal => cal.month === month);
    if (!monthCalendar) return 0;
    
    const weeklyHours = schedule.reduce((sum, s) => sum + s.weeklyHours, 0);
    const weeksInMonth = monthCalendar.workingDays / 5; // Aproximação
    
    return weeklyHours * weeksInMonth;
  },

  /**
   * Importa horário de aulas (para usar com planilha/PDF)
   */
  async importSchedule(scheduleData: Partial<ClassSchedule>[]): Promise<ClassSchedule[]> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const imported = scheduleData.map((data, index) => ({
      id: Date.now() + index,
      teacherId: data.teacherId || 0,
      teacherName: data.teacherName || '',
      subjectId: data.subjectId || 0,
      subjectName: data.subjectName || '',
      level: data.level || '',
      grade: data.grade || '',
      weeklyHours: data.weeklyHours || 0,
      dayOfWeek: data.dayOfWeek || [],
      timeSlots: data.timeSlots || [],
      classroom: data.classroom
    }));
    
    mockSchedule.push(...imported);
    return imported;
  },

  /**
   * Gera relatório de produtividade
   */
  async generateProductivityReport(month: number, year: number): Promise<{
    totalScheduled: number;
    totalActual: number;
    totalExtra: number;
    efficiency: number;
    teachers: Array<{
      name: string;
      scheduled: number;
      actual: number;
      extra: number;
      efficiency: number;
    }>;
  }> {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Simular relatório baseado nos dados mock
    return {
      totalScheduled: 420,
      totalActual: 398,
      totalExtra: 24,
      efficiency: 94.8,
      teachers: [
        { name: 'AMAURI HERNANDES JUNIOR', scheduled: 36, actual: 32, extra: 4, efficiency: 88.9 },
        { name: 'BARBARA GARCIA CAMARGO', scheduled: 18, actual: 18, extra: 2, efficiency: 100.0 }
      ]
    };
  }
};
