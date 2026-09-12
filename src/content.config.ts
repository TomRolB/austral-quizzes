import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { BIAS_CHECKS } from './content/biasChecks';

const questionSchema = z
  .object({
    id: z.number(),
    question: z.string(),
    options: z.array(z.string()),
    answerIndex: z.number().optional(),
    answerIndexes: z.array(z.number()).optional(),
  })
  .refine(
    question => (question.answerIndex === undefined) !== (question.answerIndexes === undefined),
    'Una pregunta define answerIndex (respuesta única) o answerIndexes (respuesta múltiple), pero no ambos'
  );

const quizzes = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/quizzes' }),
  schema: z.object({
    courseId: z.string(),
    courseName: z.string(),
    courseIcon: z.string(),
    id: z.string(),
    title: z.string(),
    description: z.string(),
    ignoredBiasChecks: z.array(z.enum(BIAS_CHECKS)).optional(),
    questions: z.array(questionSchema),
  }),
});

export const collections = { quizzes };
