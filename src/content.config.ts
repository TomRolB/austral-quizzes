import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const questionSchema = z.object({
  id: z.number(),
  question: z.string(),
  options: z.array(z.string()),
  answerIndex: z.number(),
});

const quizzes = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/quizzes' }),
  schema: z.object({
    courseId: z.string(),
    courseName: z.string(),
    courseIcon: z.string(),
    id: z.string(),
    title: z.string(),
    description: z.string(),
    questions: z.array(questionSchema),
  }),
});

export const collections = { quizzes };
