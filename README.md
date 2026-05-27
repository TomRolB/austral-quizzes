# Simulador de Exámenes Universitarios

Aplicación web interactiva basada en Astro para practicar simulacros de exámenes universitarios, organizada de forma dinámica mediante colecciones de contenido.

## Características
- **Separación de responsabilidades clara:** Interfaz estática construida en Astro y lógica de interacción client-side encapsulada en módulos TypeScript controladores limpios.
- **Progreso Persistente:** Respuestas y puntuaciones guardadas en `localStorage` de manera automática por examen.
- **Despliegue automático:** Integración con GitHub Actions para publicar de manera continua en GitHub Pages.

## Estructura del Proyecto
- `src/content/quizzes/` - Contiene las carpetas por materia (`courseId`) y los archivos JSON con las preguntas.
- `src/components/quiz/` - Componentes del simulador (barra de progreso, banners de puntuación y tarjetas de preguntas) junto a la lógica client-side (`quizController.ts`).
- `src/pages/` - Enrutamiento dinámico de materias (`[course]/index.astro`) y exámenes (`[course]/[quiz].astro`).

## Cómo agregar un Examen
Crea un archivo JSON dentro de `src/content/quizzes/<course-id>/` con la siguiente estructura:
```json
{
  "courseId": "economia-politica",
  "courseName": "Macroeconomía",
  "courseIcon": "📊",
  "id": "parcial-2026-c1",
  "title": "Parcial 1° cuatrimestre 2026",
  "description": "Preguntas de coyuntura y apuntes de clase.",
  "questions": [
    {
      "id": 1,
      "question": "En un monopolio la empresa puede perder dinero:",
      "options": ["a) Verdadero", "b) Falso"],
      "answerIndex": 0
    }
  ]
}
```
