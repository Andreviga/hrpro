/**
 * Página de gerenciamento acadêmico
 * Controle de aulas, horários e calendário escolar
 */
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Textarea } from '../components/ui/textarea';
import { academicApi, MonthlyClasses, ExtraClass, TeacherScheduleSummary } from '../services/academicApi';
import { employeeApi } from '../services/employeeApi';
import { 
  Calendar as CalendarIcon,
  Clock,
  Users,
  BookOpen,
  Plus,
  Edit,
  Save,
  TrendingUp,
  TrendingDown,
  Calculator,
  FileText,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';

const CalendarPage: React.FC = () => {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyClasses, setMonthlyClasses] = useState<MonthlyClasses[]>([]);
  const [extraClasses, setExtraClasses] = useState<ExtraClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('schedule');
  const [editingClass, setEditingClass] = useState<number | null>(null);

  // Estados para nova aula extra
  const [newExtraClass, setNewExtraClass] = useState({
    teacherId: 0,
    subjectName: '',
    level: '',
    date: '',
    hours: 1,
    hourlyRate: 31.44,
    type: 'extra' as const,
    description: '',
    authorizedBy: ''
  });

  useEffect(() => {
    loadData();
  }, [selectedTeacher, selectedMonth, selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar lista de professores
      const teachersData = await employeeApi.getEmployees({
        status: 'active'
      });
      setTeachers(teachersData.filter(emp => emp.position.includes('Professor')));

      // Carregar dados do mês selecionado
      if (selectedTeacher !== 'all') {
        const [classesData, extrasData] = await Promise.all([
          academicApi.getMonthlyClasses(
            parseInt(selectedTeacher),
            Number(selectedMonth),
            Number(selectedYear)
          ),
          academicApi.getExtraClasses(
            parseInt(selectedTeacher),
            Number(selectedMonth),
            Number(selectedYear)
          )
        ]);
        setMonthlyClasses(classesData);
        setExtraClasses(extrasData);
      } else {
        // Carregar dados de todos os professores
        const allClasses: MonthlyClasses[] = [];
        const allExtras: ExtraClass[] = [];
        
        for (const teacher of teachersData.filter(emp => emp.position.includes('Professor'))) {
          const [classesData, extrasData] = await Promise.all([
            academicApi.getMonthlyClasses(
              Number(teacher.id),
              Number(selectedMonth),
              Number(selectedYear)
            ),
            academicApi.getExtraClasses(
              Number(teacher.id),
              Number(selectedMonth),
              Number(selectedYear)
            )
          ]);
          allClasses.push(...classesData);
          allExtras.push(...extrasData);
        }
        
        setMonthlyClasses(allClasses);
        setExtraClasses(allExtras);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClass = async (classData: Partial<MonthlyClasses>) => {
    try {
      await academicApi.updateMonthlyClasses(classData);
      setEditingClass(null);
      loadData();
      alert('Aulas atualizadas com sucesso!');
    } catch (error) {
      alert('Erro ao atualizar aulas');
    }
  };

  const handleAddExtraClass = async () => {
    try {
      if (!newExtraClass.teacherId || !newExtraClass.subjectName || !newExtraClass.date) {
        alert('Preencha todos os campos obrigatórios');
        return;
      }

      const teacher = teachers.find(t => t.id === newExtraClass.teacherId);
      await academicApi.addExtraClass({
        ...newExtraClass,
        teacherName: teacher?.fullName || 'Professor'
      });

      setNewExtraClass({
        teacherId: 0,
        subjectName: '',
        level: '',
        date: '',
        hours: 1,
        hourlyRate: 31.44,
        type: 'extra',
        description: '',
        authorizedBy: ''
      });

      loadData();
      alert('Aula extra adicionada com sucesso!');
    } catch (error) {
      alert('Erro ao adicionar aula extra');
    }
  };

  const handleApproveExtra = async (id: number) => {
    try {
      await academicApi.updateExtraClassStatus(id, 'approved');
      loadData();
      alert('Aula extra aprovada!');
    } catch (error) {
      alert('Erro ao aprovar aula extra');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getTotalSummary = () => {
    const scheduled = monthlyClasses.reduce((sum, mc) => sum + mc.scheduledHours, 0);
    const actual = monthlyClasses.reduce((sum, mc) => sum + mc.actualHours, 0);
    const extra = monthlyClasses.reduce((sum, mc) => sum + mc.extraHours, 0) + 
                 extraClasses.filter(ec => ec.status === 'approved').reduce((sum, ec) => sum + ec.hours, 0);
    
    return { scheduled, actual, extra, total: actual + extra };
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Carregando dados acadêmicos...</span>
        </div>
      </Layout>
    );
  }

  const summary = getTotalSummary();

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📚 Gestão Acadêmica</h1>
            <p className="text-gray-600 mt-1">
              Controle de aulas, horários e calendário escolar
            </p>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Professor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Professores</SelectItem>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id.toString()}>
                        {teacher.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({length: 12}, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {new Date(0, i).toLocaleDateString('pt-BR', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Aulas Programadas</p>
                  <p className="text-xl font-bold">{summary.scheduled}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Aulas Dadas</p>
                  <p className="text-xl font-bold">{summary.actual}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Plus className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600">Aulas Extras</p>
                  <p className="text-xl font-bold">{summary.extra}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-xl font-bold">{summary.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schedule">Horário Mensal</TabsTrigger>
            <TabsTrigger value="extra">Aulas Extras</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
          </TabsList>

          {/* Tab: Horário Mensal */}
          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  Aulas - {new Date(0, selectedMonth - 1).toLocaleDateString('pt-BR', { month: 'long' })} {selectedYear}
                </CardTitle>
                <CardDescription>
                  {selectedTeacher === 'all' ? 'Todos os professores' : teachers.find(t => t.id.toString() === selectedTeacher)?.fullName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyClasses.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhuma aula cadastrada
                    </h3>
                    <p className="text-gray-600">
                      Configure o horário de aulas para o período selecionado.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {monthlyClasses.map((classData) => (
                      <Card key={classData.id} className="border">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <h4 className="font-semibold">{classData.teacherName}</h4>
                                <Badge variant="outline">{classData.subjectName}</Badge>
                                <Badge variant="secondary">{classData.level}</Badge>
                              </div>
                              
                              {editingClass === classData.id ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                                  <div>
                                    <Label>Programadas</Label>
                                    <Input
                                      type="number"
                                      defaultValue={classData.scheduledHours}
                                      onChange={(e) => {
                                        classData.scheduledHours = parseInt(e.target.value) || 0;
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <Label>Realizadas</Label>
                                    <Input
                                      type="number"
                                      defaultValue={classData.actualHours}
                                      onChange={(e) => {
                                        classData.actualHours = parseInt(e.target.value) || 0;
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <Label>Extras</Label>
                                    <Input
                                      type="number"
                                      defaultValue={classData.extraHours}
                                      onChange={(e) => {
                                        classData.extraHours = parseInt(e.target.value) || 0;
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <Label>Substituições</Label>
                                    <Input
                                      type="number"
                                      defaultValue={classData.substitutionHours}
                                      onChange={(e) => {
                                        classData.substitutionHours = parseInt(e.target.value) || 0;
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-gray-500">Programadas</p>
                                    <p className="font-medium">{classData.scheduledHours}h</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Realizadas</p>
                                    <p className="font-medium text-green-600">{classData.actualHours}h</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Extras</p>
                                    <p className="font-medium text-orange-600">{classData.extraHours}h</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Substituições</p>
                                    <p className="font-medium text-blue-600">{classData.substitutionHours}h</p>
                                  </div>
                                </div>
                              )}

                              {classData.observations && (
                                <div className="mt-3 p-2 bg-yellow-50 rounded">
                                  <p className="text-sm text-yellow-800">{classData.observations}</p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center space-x-2">
                              {editingClass === classData.id ? (
                                <>
                                  <Button size="sm" onClick={() => handleUpdateClass(classData)}>
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => setEditingClass(null)}>
                                    Cancelar
                                  </Button>
                                </>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => setEditingClass(classData.id)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Aulas Extras */}
          <TabsContent value="extra" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Nova Aula Extra</CardTitle>
                <CardDescription>
                  Registre aulas extras, substituições e reforços
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Professor</Label>
                    <Select value={newExtraClass.teacherId.toString()} onValueChange={(value) => setNewExtraClass({...newExtraClass, teacherId: parseInt(value)})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o professor" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id.toString()}>
                            {teacher.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Disciplina</Label>
                    <Input
                      value={newExtraClass.subjectName}
                      onChange={(e) => setNewExtraClass({...newExtraClass, subjectName: e.target.value})}
                      placeholder="Ex: Matemática"
                    />
                  </div>

                  <div>
                    <Label>Nível</Label>
                    <Select value={newExtraClass.level} onValueChange={(value) => setNewExtraClass({...newExtraClass, level: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o nível" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ensino Infantil">Ensino Infantil</SelectItem>
                        <SelectItem value="Fundamental I">Fundamental I</SelectItem>
                        <SelectItem value="Fundamental II">Fundamental II</SelectItem>
                        <SelectItem value="Ensino Médio">Ensino Médio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={newExtraClass.date}
                      onChange={(e) => setNewExtraClass({...newExtraClass, date: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label>Horas</Label>
                    <Input
                      type="number"
                      min="1"
                      max="8"
                      value={newExtraClass.hours}
                      onChange={(e) => setNewExtraClass({...newExtraClass, hours: parseInt(e.target.value)})}
                    />
                  </div>

                  <div>
                    <Label>Valor por Hora</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newExtraClass.hourlyRate}
                      onChange={(e) => setNewExtraClass({...newExtraClass, hourlyRate: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>

                <div>
                  <Label>Tipo de Aula</Label>
                  <Select value={newExtraClass.type} onValueChange={(value) => setNewExtraClass({...newExtraClass, type: value as any})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="extra">Aula Extra</SelectItem>
                      <SelectItem value="substitution">Substituição</SelectItem>
                      <SelectItem value="recovery">Recuperação</SelectItem>
                      <SelectItem value="reinforcement">Reforço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={newExtraClass.description}
                    onChange={(e) => setNewExtraClass({...newExtraClass, description: e.target.value})}
                    placeholder="Descrição da aula extra..."
                    rows={2}
                  />
                </div>

                <Button onClick={handleAddExtraClass} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Aula Extra
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Aulas Extras Registradas</CardTitle>
              </CardHeader>
              <CardContent>
                {extraClasses.length === 0 ? (
                  <div className="text-center py-8">
                    <Plus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhuma aula extra registrada
                    </h3>
                    <p className="text-gray-600">
                      As aulas extras aparecerão aqui após serem registradas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {extraClasses.map((extra) => (
                      <div key={extra.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1">
                            <h4 className="font-medium">{extra.teacherName}</h4>
                            <Badge variant="outline">{extra.subjectName}</Badge>
                            <Badge className={
                              extra.status === 'approved' ? 'bg-green-100 text-green-800' :
                              extra.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {extra.status === 'approved' ? 'Aprovado' :
                               extra.status === 'pending' ? 'Pendente' : 'Rejeitado'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {new Date(extra.date).toLocaleDateString('pt-BR')} • 
                            {extra.hours}h • {formatCurrency(extra.hourlyRate * extra.hours)}
                          </p>
                          <p className="text-sm text-gray-500">{extra.description}</p>
                        </div>

                        {extra.status === 'pending' && (
                          <Button size="sm" onClick={() => handleApproveExtra(extra.id)}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Relatórios */}
          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Relatórios em Desenvolvimento
                </h3>
                <p className="text-gray-600">
                  Em breve você terá acesso a relatórios detalhados de produtividade e frequência.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default CalendarPage;
