import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type, Schema } from '@google/genai';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || './data';
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database template if empty
if (!fs.existsSync(DB_FILE)) {
  const initialData = {
    school: { name: "OEMS Academy", motto: "Excellence Online", academicYear: "2026/2027", term: "Term 1", address: "Localhost", contactEmail: "admin@oems.edu", contactPhone: "12345" },
    students: [
      { id: "s1", studentId: "STU001", fullName: "Jane Doe", username: "student", password: "change-this-password", classGrade: "All", gender: "Female", email: "jane@example.com", status: "active" }
    ],
    exams: [],
    attempts: [],
    auditLogs: []
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

// Helper to read/write JSON flat-file database
const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const writeDB = (data: any) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// Initialize Gemini SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/* ----------------------------------------------------------- API Endpoints -- */

// Bootstrap application data
app.get('/api/bootstrap', (req, res) => {
  try {
    const db = readDB();
    res.json({ success: true, data: db });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Authentication endpoints
app.post('/api/login/:role', (req, res) => {
  const { role } = req.params;
  const { username, password } = req.body;
  const db = readDB();

  if (role === 'admin') {
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      return res.json({ success: true, user: { fullName: "Administrator", role: "admin" } });
    }
  } else if (role === 'student') {
    const student = db.students.find((s: any) => s.username === username && s.password === password && s.status === 'active');
    if (student) {
      return res.json({ success: true, user: { id: student.id, fullName: student.fullName, role: "student", student } });
    }
  }
  res.status(401).json({ success: false, error: "Invalid username or password" });
});

// Manage Exams
app.post('/api/exams', (req, res) => {
  try {
    const db = readDB();
    const newExam = {
      id: `exam_${Date.now()}`,
      status: 'draft',
      ...req.body
    };
    db.exams.push(newExam);
    writeDB(db);
    res.json({ success: true, exam: newExam });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/exams/:id/status', (req, res) => {
  const db = readDB();
  const exam = db.exams.find((e: any) => e.id === req.params.id);
  if (exam) {
    exam.status = req.body.status;
    writeDB(db);
    return res.json({ success: true });
  }
  res.status(404).json({ success: false, error: "Exam not found" });
});

// Gemini AI PDF/Text Question Extractor
app.post('/api/import-questions-gemini', async (req, res) => {
  try {
    const { base64Pdf, rawText, defaultMarks } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.json({ success: false, error: "Backend GEMINI_API_KEY environment variable is not configured." });
    }

    let contents: any[] = [];
    let promptText = `Extract all multiple choice exam questions. Assign a clear index, question text, 2 to 4 option letters (A, B, C, D), and identify the correctAnswer (capital single character like 'A', 'B', 'C', or 'D'). Set default marks to ${defaultMarks || 5}.`;

    if (base64Pdf) {
      // Split header data from base64 if existing
      const base64Data = base64Pdf.includes(',') ? base64Pdf.split(',')[1] : base64Pdf;
      contents.push({
        inlineData: {
          mimeType: "application/pdf",
          data: base64Data
        }
      });
      promptText += " Read this attached document file carefully to parse the questions.";
    } else if (rawText) {
      promptText += `\n\nParse this layout text:\n${rawText}`;
    } else {
      return res.status(400).json({ success: false, error: "Provide either a PDF file or text string." });
    }

    contents.push(promptText);

    // Strict Response Schema match for React structure requirements
    const jsonSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "Generate a brief randomized string id" },
              text: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["multiple_choice"] },
              correctAnswer: { type: Type.STRING },
              marks: { type: Type.INTEGER },
              options: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING, description: "A, B, C, or D" },
                    text: { type: Type.STRING }
                  },
                  required: ["id", "label", "text"]
                }
              }
            },
            required: ["id", "text", "type", "options", "correctAnswer", "marks"]
          }
        }
      },
      required: ["questions"]
    };

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: jsonSchema,
        temperature: 0.2,
      }
    });

    const parsedResult = JSON.parse(response.text || '{"questions": []}');
    res.json({ success: true, questions: parsedResult.questions });

  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed processing with Gemini AI" });
  }
});

// Wildcard fallback serving static production files
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    res.status(404).json({ error: "API Route Not Found" });
  }
});

app.listen(PORT, () => {
  console.log(`[OEMS Server] Running on http://localhost:${PORT}`);
});
