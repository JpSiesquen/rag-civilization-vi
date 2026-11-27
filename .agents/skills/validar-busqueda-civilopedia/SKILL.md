---
name: validar-busqueda-civilopedia
description: Valida la recuperación en español de la Civilopedia de Civilization VI en SQL Server local. Usa esta skill al modificar dbo.SearchCivilopedia o investigar el orden de los resultados, las referencias a las fuentes o los filtros de versión, contenido, modo y escenario.
---

# Validar la búsqueda de la Civilopedia

Ejecuta las comprobaciones desde la raíz del repositorio. Consulta [la preparación local](../../../README.md#verify-local-full-text-retrieval) para identificar la revisión de búsqueda, los datos de prueba y el índice de texto completo que necesita el caso. Usa la base local `CivilizationVI_Rag_Dev`.

| Cambio o síntoma | Prueba | Resultado esperado |
| --- | --- | --- |
| Relevancia, referencias o ausencia de coincidencias | [check_civilopedia_search.sql](../../../database/check_civilopedia_search.sql) | El fragmento de Gathering Storm sobre el arrecife junto al Campus y la referencia `Reef_Science` aparecen entre los tres primeros resultados. Una consulta sin coincidencias devuelve cero filas. |
| Filtro por versión | [check_civilopedia_search_versions.sql](../../../database/check_civilopedia_search_versions.sql) | Cada versión devuelve la evidencia de selva tropical del Campus con su referencia `Jungle_Science` y solo fragmentos de la versión solicitada. Una versión no admitida se rechaza. |
| Contenido, modo o escenario | [check_civilopedia_search_context.sql](../../../database/check_civilopedia_search_context.sql) | La evidencia sobre líneas ley requiere Sociedades secretas y el paquete Etiopía. La evidencia de escenario requiere una consulta explícita al escenario. |

Selecciona las pruebas que cubran el cambio. Sustituye el archivo en este comando según la tabla.

```powershell
sqlcmd -S lpc:. -E -N -C -b -d CivilizationVI_Rag_Dev -i database/check_civilopedia_search.sql
```

La prueba de contexto inserta y elimina una ficha sintética de escenario en la base local. Las pruebas de relevancia y versión consultan la base sin modificar sus tablas. Aplicar migraciones y cargar datos de prueba son pasos de preparación que escriben en SQL Server. Realízalos si hacen falta y están dentro del alcance de la tarea.

Si falla una prueba, indica el error de SQL y la expectativa que falló. Si faltan filas esperadas, comprueba que los datos requeridos estén cargados y que el índice de texto completo los haya incorporado. Al terminar, indica qué pruebas ejecutaste, cuáles pasaron y qué requisito local impidió ejecutar cada prueba pendiente.
