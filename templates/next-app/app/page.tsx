import { queryMssql } from "../lib/db";
import { createProductAction } from "./actions";

interface Product {
  ProductoID: number;
  Sku: string;
  Nombre: string;
  Precio: number;
}

export default async function Page() {
  // Carga de datos del lado del servidor de forma directa y asíncrona
  let products: Product[] = [];
  try {
    products = await queryMssql<Product>(
      "SELECT TOP 50 ProductoID, Sku, Nombre, Precio FROM Productos ORDER BY ProductoID DESC"
    );
  } catch (err) {
    console.error("Error al cargar productos desde la base de datos:", err);
  }

  return (
    <div>
      <h1 style={{ fontWeight: 700, fontSize: "2rem", marginBottom: "1.5rem" }}>
        Gestión de Productos
      </h1>
      
      {/* Formulario Server Action directo (Ejecutado enteramente en el servidor) */}
      <div className="card">
        <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>Agregar Nuevo Producto</h2>
        <form action={createProductAction} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "450px" }}>
          <div>
            <label htmlFor="sku" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>SKU</label>
            <input 
              id="sku" 
              name="sku" 
              type="text" 
              required 
              style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid var(--border)", backgroundColor: "var(--input)", color: "white" }} 
            />
          </div>
          <div>
            <label htmlFor="name" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Nombre</label>
            <input 
              id="name" 
              name="name" 
              type="text" 
              required 
              style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid var(--border)", backgroundColor: "var(--input)", color: "white" }} 
            />
          </div>
          <div>
            <label htmlFor="price" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.875rem" }}>Precio</label>
            <input 
              id="price" 
              name="price" 
              type="number" 
              step="0.01" 
              required 
              style={{ width: "100%", padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid var(--border)", backgroundColor: "var(--input)", color: "white" }} 
            />
          </div>
          <button type="submit" className="btn" style={{ alignSelf: "flex-start", marginTop: "0.5rem" }}>
            Guardar Producto
          </button>
        </form>
      </div>

      {/* Listado cargado en Server Side Rendering (SSR) */}
      <div className="card">
        <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>Listado de Productos</h2>
        <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
          {products.map((p) => (
            <li key={p.ProductoID} style={{ marginBottom: "0.5rem" }}>
              <strong>{p.Sku}</strong> — {p.Nombre} (${Number(p.Precio).toFixed(2)})
            </li>
          ))}
          {products.length === 0 && (
            <li style={{ listStyleType: "none", color: "#94a3b8" }}>
              No hay productos registrados en la base de datos.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
