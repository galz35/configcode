# Patrones y Optimización Avanzada en SQL Server

Esta guía técnica recopila los patrones de diseño, optimización de consultas y características avanzadas de SQL Server para el desarrollo de bases de datos robustas, eficientes y seguras.

---

## 1. CTEs (Common Table Expressions) y CTEs Recursivos

Las CTEs mejoran la legibilidad del código. Son indispensables para simplificar subconsultas complejas y necesarias para manejar estructuras jerárquicas mediante recursividad.

### Ejemplo de CTE Recursivo (Estructura de Organización/Árbol)
```sql
WITH OrgHierarchy AS (
    -- Miembro Ancla: El empleado de nivel superior (ej. Gerente General)
    SELECT 
        EmpleadoID, 
        Nombre, 
        ReportaA, 
        1 AS Nivel
    FROM Empleados
    WHERE ReportaA IS NULL

    UNION ALL

    -- Miembro Recursivo: Unir jerárquicamente a los subordinados
    SELECT 
        e.EmpleadoID, 
        e.Nombre, 
        e.ReportaA, 
        oh.Nivel + 1
    FROM Empleados e
    INNER JOIN OrgHierarchy oh ON e.ReportaA = oh.EmpleadoID
)
SELECT EmpleadoID, Nombre, ReportaA, Nivel
FROM OrgHierarchy
ORDER BY Nivel;
```

---

## 2. Funciones de Ventana (Window Functions)

Permiten realizar cálculos agregados sin agrupar el conjunto de resultados completo (conservando las filas individuales).

### Ejemplos Clave:
- **`ROW_NUMBER()`**: Genera un índice incremental único por partición.
- **`DENSE_RANK()`**: Asigna rangos sin saltarse números en caso de empates.
- **`LAG()` / `LEAD()`**: Accede a valores de la fila anterior o siguiente sin recurrir a auto-joins costosos.

```sql
-- Obtener las 3 solicitudes de empleo más recientes de cada postulante
WITH RankedSolicitudes AS (
    SELECT 
        SolicitudID,
        PostulanteID,
        FechaCreacion,
        SalarioPretencion,
        ROW_NUMBER() OVER (
            PARTITION BY PostulanteID 
            ORDER BY FechaCreacion DESC
        ) AS FilaNum
    FROM Solicitudes
)
SELECT SolicitudID, PostulanteID, FechaCreacion, SalarioPretencion
FROM RankedSolicitudes
WHERE FilaNum <= 3;
```

---

## 3. Optimización de Consultas y Plan de Ejecución

### Prácticas de Indexación:
1. **Clustered Index (Índice Clúster):** Define físicamente el orden de almacenamiento de los datos en disco. Normalmente asociado a la Clave Primaria. Solo puede existir uno por tabla.
2. **Non-Clustered Index (Índice No Clúster):** Un puntero a las filas físicas. Utilízalo en columnas que aparecen frecuentemente en el `WHERE`, `JOIN` u `ORDER BY`.
3. **Covering Index (Índice de Cobertura con `INCLUDE`):** Agrega columnas de salida en las hojas del índice no clúster para evitar una costosa búsqueda en la tabla base (Key Lookup / RID Lookup).
   ```sql
   CREATE NONCLUSTERED INDEX IX_Solicitudes_Estado
   ON Solicitudes (Estado)
   INCLUDE (FechaCreacion, PostulanteID);
   ```

### Evitar el "Sargability Antipattern":
Evita aplicar funciones sobre las columnas que están indexadas en el bloque `WHERE`, ya que esto anula el uso del índice (provocando un Index Scan completo en lugar de un Index Seek rápido).

- **Antipatrón ❌ (No sargable):**
  ```sql
  SELECT ID FROM Solicitudes WHERE YEAR(FechaCreacion) = 2026;
  ```
- **Práctica Recomendada ✅ (Sargable):**
  ```sql
  SELECT ID FROM Solicitudes 
  WHERE FechaCreacion >= '2026-01-01' AND FechaCreacion < '2027-01-01';
  ```

---

## 4. Tablas Temporales e Históricas (Temporal Tables)

SQL Server permite realizar un seguimiento automático de todo el historial de cambios en una tabla sin crear triggers manuales.

### Creación de una Tabla Temporal de Sistema:
```sql
CREATE TABLE Candidatos (
    CandidatoID INT IDENTITY(1,1) PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Telefono VARCHAR(20) NULL,
    UsuarioModifica VARCHAR(50) NOT NULL,
    -- Columnas de validez de periodo (obligatorias)
    SysStartTime DATETIME2 GENERATED ALWAYS AS ROW START NOT NULL,
    SysEndTime DATETIME2 GENERATED ALWAYS AS ROW END NOT NULL,
    PERIOD FOR SYSTEM_TIME (SysStartTime, SysEndTime)
)
WITH (
    SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.Candidatos_Historial)
);
```

### Consultar datos en un punto específico en el tiempo:
```sql
-- Ver cómo estaba la tabla el 1 de junio de 2026
SELECT * FROM Candidatos
FOR SYSTEM_TIME AS OF '2026-06-01T12:00:00';
```

---

## 5. Particionamiento de Tablas

Diseñado para tablas con millones de filas (ej: logs de auditoría o transacciones históricas).

1. **Partition Function (Función de Partición):** Define los límites de rango para dividir los datos (normalmente por fechas).
2. **Partition Scheme (Esquema de Partición):** Asocia los rangos de la función a diferentes Filegroups físicos.
3. **Mantenimiento Rápido (`SWITCH PARTITION`):** Permite mover particiones completas de datos antiguos a tablas de archivo en milisegundos, en lugar de ejecutar sentencias `DELETE` masivas que saturan el Log de Transacciones.

---

## 6. CDC (Change Data Capture)

Registra automáticamente las operaciones de inserción, actualización y eliminación aplicadas a las tablas configuradas, depositando los cambios en tablas de cambio del sistema. Es ideal para procesos ETL o sincronización en tiempo real con otros sistemas.

```sql
-- Habilitar CDC en la base de datos
USE SolicitudEmpleo;
GO
EXEC sys.sp_cdc_enable_db;
GO

-- Habilitar CDC en una tabla específica
EXEC sys.sp_cdc_enable_table
    @source_schema = N'dbo',
    @source_name   = N'Solicitudes',
    @role_name     = NULL, -- Rol de seguridad para acceder a los datos de CDC
    @supports_net_changes = 1;
GO
```
