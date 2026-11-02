export interface ExamOption {
  id: string;
  label: string;
  text: string;
}

export interface ExamQuestion {
  id: string;
  questionNumber: number;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | string;
  text: string;
  options: ExamOption[];
  correctAnswer: string;
  marks: number;
  explanation?: string;
}

export interface Examination {
  id?: string;
  title: string;
  subject: string;
  targetClass: string;
  instructions?: string;
  date?: string;
  startTime?: string;
  closingTime?: string;
  durationMinutes: number;
  totalMarks: number;
  passMarks?: number;
  status: string;
  showResultsImmediately?: boolean;
  questions: ExamQuestion[];
  [key: string]: unknown;
}

export interface OEMSData {
  school: Record<string, any>;
  students: any[];
  exams: Examination[];
  attempts: any[];
  auditLogs: any[];
  [key: string]: any;
}
