---
argument-hint: <spec-file-path-or-pasted-specification>
description: Generate a technical plan, always in Spanish, from a specification (file path or pasted text)
---

# Plan Técnico a partir de una Especificación

## Input

The following arguments were provided: `$ARGUMENTS`

### Parsing logic

```
CASE 1: Argument is a path to an existing file (e.g. "docs/features/SMP-1234/spec.md")
  - Read the file and use its content as the specification
  - feature_name = ticket id matching "[A-Z]+-\d+" in the path, otherwise the file name without extension

CASE 2: Argument is free text (a pasted specification)
  - Use the text as the specification
  - feature_name = short kebab-case slug derived from the specification title or first sentence

CASE 3: No argument
  - Use AskUserQuestion to ask for the file path or the specification text
```

---

## LANGUAGE RULE (NON-NEGOTIABLE)

The technical plan and **everything you say to the user** (questions, summaries, status) MUST be written in **Spanish**, regardless of the language of the specification or of the arguments.

- Translate section headings, descriptions, risks, questions and notes into Spanish.
- Keep in their original form: code, identifiers, file paths, HTTP methods, endpoints, JSON keys, library/framework names, and well-established technical terms (endpoint, middleware, rollback, etc.).
- Code comments and docstrings inside the plan are also in Spanish.

---

## Workflow

### 1. Entender la especificación

- Read the specification completely.
- Explore the current repository (structure, stack, existing patterns, related code) so the plan fits the real codebase instead of being generic.
- Load the relevant convention skills when applicable (`backend-microservices-directory-structure`, `backend-api-design`, `backend-fastapi`, `backend-django-drf`, `frontend-directory-structure`, etc.).

### 2. Aclarar dudas

If the specification is ambiguous or incomplete, ask the user **before** writing the plan, in Spanish, with options in A) B) C) format. Cover only what blocks the plan: scenarios, edge cases, integrations, performance, dependencies. If nothing blocks, continue without asking.

### 3. Redactar el plan

Create `docs/features/{feature_name}/plan_tecnico.md` (create the directory if needed) with this structure, omitting sections that do not apply:

```markdown
# Plan Técnico: {feature_name}

**Estado:** Borrador
**Fecha:** {fecha}
**Especificación:** {ruta o "texto proporcionado por el usuario"}

## 1. Resumen
{2-3 párrafos: qué se construye, por qué y alcance}

## 2. Alcance
### Incluido
- {…}
### Fuera de alcance
- {…}

## 3. Supuestos y preguntas abiertas
- {supuesto o pregunta pendiente}

## 4. Arquitectura y diseño
{Enfoque general, capas afectadas, decisiones clave y alternativas descartadas}

## 5. Modelo de dominio y datos
- Entidades nuevas/modificadas, value objects, reglas de negocio
- Migraciones necesarias

## 6. API
| Método | Ruta | Propósito | Request | Response |
|--------|------|-----------|---------|----------|

{Códigos de error y permisos por endpoint}

## 7. Cambios por componente
### {componente / microservicio / módulo}
| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `ruta/archivo.py` | CREAR / MODIFICAR | {qué cambia y por qué} |

## 8. Integraciones y eventos
{Llamadas a otros servicios, eventos publicados/consumidos}

## 9. Seguridad y permisos
{…}

## 10. Estrategia de pruebas
{Unitarias, integración, API, casos límite}

## 11. Plan de implementación
1. {paso, en orden de dependencia}

## 12. Riesgos y mitigaciones
| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|--------------|------------|

## 13. Despliegue y rollback
{Orden de despliegue, feature flags, estrategia de reversión}
```

### 4. Iterar

Present a short summary in Spanish and ask for feedback. Update the plan file until the user approves it.

---

## Output Summary

When done, reply in Spanish with:

```
## Plan técnico generado: {feature_name}

**Archivo:** `docs/features/{feature_name}/plan_tecnico.md`

### Resumen
{3-5 líneas}

### Decisiones clave
1. {…}

### Preguntas abiertas
- {…}
```

---

## Rules

- **SIEMPRE** responde y escribe el plan en español.
- **DO NOT** implement code — this command produces the plan only.
- **DO** ground the plan in the real repository, not in generic assumptions.
- **DO** ask in Spanish before planning only if something blocks it.
- **NEVER** invent requirements that are not in the specification; list them as assumptions or open questions instead.
