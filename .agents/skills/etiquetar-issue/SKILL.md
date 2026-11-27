---
name: etiquetar-issue
description: Redacta y clasifica issues de GitHub para Civilization VI RAG. Úsala para preparar una issue, revisar etiquetas y dependencias o construir el backlog de una fase.
---

# Redactar y etiquetar issues

Revisa las issues, etiquetas y milestones del repositorio antes de proponer cambios. Busca duplicados y reutiliza las convenciones existentes. Si la tarea es preparar un borrador, devuelve el título, el cuerpo y los metadatos propuestos. Publica o modifica issues solo cuando la tarea lo autorice.

## Título y metadatos

Usa `F-N · Entregable concreto`, donde `F` es la fase y `N` el orden del trabajo dentro de esa fase. El número de GitHub sirve para enlazar la issue. Si insertas una issue entre otras, puedes usar un sufijo como `2-3b` para conservar la numeración existente.

| Decisión | Criterio |
| --- | --- |
| Tipo | Una etiqueta. Usa `bug` para defectos, `enhancement` para funcionalidad o mejoras, `chore` para configuración y mantenimiento, `documentation` para documentación y `question` para dudas. |
| Dificultad | Una etiqueta según el riesgo de equivocarse. Usa `dificultad:facil` si un fallo se detecta enseguida, `dificultad:media` si requiere pruebas y `dificultad:dificil` si puede propagarse o ser costoso de corregir. |
| Área | Una o varias etiquetas según los componentes afectados. Revisa las disponibles en el repositorio, como `area:backend`, `area:datos`, `area:docs`, `area:frontend`, `area:ia` y `area:infra`. |
| Prioridad | Una etiqueta. Usa `priority:critical` para un bloqueo general o un riesgo para personas o datos, `priority:high` para un requisito de la entrega, `priority:medium` para trabajo valioso que permite seguir avanzando y `priority:low` para trabajo que puede esperar. |
| Responsable | Usa el campo de asignación cuando alguien se hará cargo del trabajo en curso. Mantén sin asignar las tareas pendientes de tomar. |
| Milestone | Selecciona el milestone de la fase correspondiente. |
| Dependencias | Escribe los bloqueos directos en el contexto, por ejemplo `Depende de #12.` Incluye el número de una issue existente y usa las palabras de cierre solo en el PR que implementa el cambio. |

## Cuerpo

```markdown
## Contexto
La búsqueda debe conservar la versión que el jugador eligió.
Depende de #12.

## Tareas
- [ ] Aplicar el filtro de versión antes de limitar los resultados.

## Criterio de aceptación
Con dos fragmentos equivalentes de versiones distintas, la búsqueda solo devuelve el fragmento de la versión seleccionada.
```

Explica el problema y su impacto. Escribe tareas concretas y un criterio comprobable con un ejemplo, una prueba o una observación. Usa ejemplos ficticios cuando hagan falta. Mantén los apuntes privados, el corpus local y las credenciales fuera del contenido público.

Si el usuario pide armar un backlog completo con más de dos fases o unas cincuenta issues, representa todas las fases. Detalla las tareas cercanas con contexto, checklist, dependencias y criterio de aceptación. Resume las lejanas con contexto, criterio preliminar y dependencias conocidas. Completa su detalle antes de empezar a implementarlas.

## Revisar y cerrar

- Antes de terminar, verifica que la issue tiene un resultado concreto, un criterio de aceptación observable y las dependencias directas correctas.
- En cambios versionados, mantén una issue por cambio integrado. Usa `Closes #N` en el cuerpo del PR hacia la rama principal cuando corresponda y verifica el criterio de aceptación antes de integrar.
- En gestiones externas sin cambios versionados, comprueba el resultado antes de cerrar. Si el cierre está autorizado, deja constancia del resultado, la fecha y la evidencia que pueda compartirse. Si falta una confirmación, registra el bloqueo y mantén la issue abierta.
