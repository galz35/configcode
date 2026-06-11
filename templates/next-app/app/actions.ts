"use server";

import { queryMssql } from "../lib/db";
import sql from "mssql";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Esquema de validación para entradas del usuario (Zod)
const ProductSchema = z.object({
  sku: z.string().min(3).max(50),
  name: z.string().min(2).max(200),
  price: z.coerce.number().positive("El precio debe ser un número positivo"),
});

export type ActionState = {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

export async function createProductAction(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Validar entradas
  const parsed = ProductSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    price: formData.get("price"),
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    // 2. Consulta SQL parametrizada directa (Sin ORMs)
    await queryMssql(
      `INSERT INTO Productos (Sku, Nombre, Precio) 
       VALUES (@sku, @nombre, @precio)`,
      [
        { name: "sku", type: sql.VarChar, value: parsed.data.sku },
        { name: "nombre", type: sql.VarChar, value: parsed.data.name },
        { name: "precio", type: sql.Decimal, value: parsed.data.price },
      ]
    );

    // 3. Revalidar la caché de la página principal para refrescar la lista
    revalidatePath("/");

    return {
      success: true,
      message: "Producto creado con éxito.",
    };
  } catch (error: any) {
    console.error("Error al crear producto:", error);
    return {
      success: false,
      message: error.message || "Error interno del servidor",
    };
  }
}
