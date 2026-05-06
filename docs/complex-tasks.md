# Protocolo de Tareas Complejas

## Cuando aplicar

Esta protocolo es OBLIGATORIO cuando la tarea involucra:
- 3+ archivos que interactuan entre si
- Debug de un bug reportado (no obvio)
- Refactor que toca 5+ archivos
- Arquitectura de nueva funcionalidad grande
- Optimizacion de performance
- Cualquier tarea donde no estes 100% seguro del camino

## Fase 1: Planear (sin codigo)

Antes de escribir UNA SOLA LINEA de codigo, escribe el plan:

```
## PLAN
**Objetivo**: [que queremos lograr]
**Archivos afectados**: [lista]
**Riesgos**: [que puede salir mal]
**Pasos**:
1. ...
2. ...
3. ...
```

Pregunta: "Este plan tiene sentido? Aprobado para ejecutar?"

## Fase 2: Checklist de requisitos

Para cada tipo de tarea:

### Bug
- [ ] Stack trace completo disponible
- [ ] Archivos involucrados identificados
- [ ] Cuando comenzo a fallar?
- [ ] Que cambio entre "funciona" y "no funciona"?
- [ ] Como reproducir?
- [ ] Tiene tests que cubren este caso?

### Refactor 
- [ ] Archivos que TOCAR (no los que solo lees)
- [ ] Dependencias entre archivos
- [ ] Tests existentes que deben seguir pasando
- [ ] Contrato publico que NO puede cambiar
- [ ] Como verificar que no rompio nada?

### Feature
- [ ] Input/Output definido (DTOs, tipos)
- [ ] Edge cases identificados (null, empty, duplicado, timeout)
- [ ] Auth/seguridad requerida?
- [ ] Cache layer?
- [ ] Rate limiting?
- [ ] Tests planeados

## Fase 3: Descomposicion en subtasks

Divide la tarea en pasos ATOMICOS:

```
PASO 1: [accion unica, verificable]
  Hacer: ...
  Validar: tsc check / flutter analyze / cargo check
  
PASO 2: depende de paso 1
  ...

SOLO AVANZAR AL PASO N+1 CUANDO PASO N ESTE VERIFICADO
```

Cada paso debe ser tan pequeno que:
- Se puede hacer en 1-3 minutos
- Se puede verificar inmediatamente (compila? pasa tests?)
- Si falla, sabes exactamente donde

## Fase 4: Ejecucion con loops

```
while tarea_no_completa:
    ejecutar_paso_actual()
    validar()  # tsc check, cargo check, flutter analyze
    si error:
        corregir()  # loop interno hasta que pase
        volver a validar()
    avanzar_paso()
```

## Protocolo de comunicacion

Cuando el usuario pide algo complejo:

1. "Voy a planear primero..."
2. Escribe el plan
3. Espera confirmacion
4. "Paso 1 de N: [descripcion]"
5. Ejecuta + valida
6. Reporta resultado
7. Repite hasta N

## Checklist de sanity (antes de entregar)

Siempre ejecutar ANTES de decir "listo":
- [ ] `tsc --noEmit` o `cargo check` o `flutter analyze` — 0 errores
- [ ] Tests existentes pasan
- [ ] No hay `console.log`, `todo!()`, `// FIXME`, codigo comentado
- [ ] Errores de compilacion? NO (el custom tool los detecta)
- [ ] SQL injection posible? NO (queries parametrizadas)
- [ ] Secrets en el codigo? NO
- [ ] ORM usado? NO (GOLDEN_RULES lo prohibe)
